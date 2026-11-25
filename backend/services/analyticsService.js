// Genuine platform analytics.
//
// Only statistics that a platform actually reports through an authorized API
// are returned as verified. Anything the platform does not expose publicly is
// returned as unavailable with a reason — never estimated, never simulated.
const { loadEnv } = require('./env');
const log = require('./logService');
const db = require('./db');
const { validateVideoUrl, extractYouTubeId } = require('./platformService');

loadEnv();

const CACHE_TTL_MS = 60 * 1000; // reuse a result for 1 minute
const HISTORY_LIMIT = 120;

const UNAVAILABLE = {
  watchTime: {
    available: false,
    reason: 'YouTube Analytics API requires OAuth access to a channel you own. A public API key cannot read watch time.'
  },
  retention: {
    available: false,
    reason: 'Audience retention is owner-only data. It is not exposed by the public YouTube Data API.'
  },
  trafficSources: {
    available: false,
    reason: 'Traffic sources require the YouTube Analytics API with owner OAuth credentials.'
  }
};

function cacheKey(platform, videoId) {
  return `${platform}:${videoId}`;
}

function getCache() {
  const raw = db.get('analytics');
  return raw && typeof raw === 'object' ? raw : {};
}

function saveCache(cache) {
  db.set('analytics', cache);
}

async function fetchYouTube(videoId) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      verified: false,
      error: 'api_key_missing',
      message: 'Set YOUTUBE_API_KEY in .env to read verified YouTube statistics.',
      hint: 'Create a key at https://console.cloud.google.com/apis/credentials and enable "YouTube Data API v3".',
      unavailable: UNAVAILABLE
    };
  }
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${encodeURIComponent(videoId)}&key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = body?.error?.message || `YouTube API returned HTTP ${res.status}`;
    return { ok: false, verified: false, error: 'api_error', message: reason };
  }
  const item = (body.items || [])[0];
  if (!item) {
    return { ok: false, verified: false, error: 'video_not_found', message: 'The YouTube API did not return this video. It may be private or removed.' };
  }
  const st = item.statistics || {};
  const sn = item.snippet || {};
  return {
    ok: true,
    verified: true,
    source: 'youtube_data_api_v3',
    fetchedAt: new Date().toISOString(),
    video: {
      id: videoId,
      title: sn.title || null,
      channel: sn.channelTitle || null,
      publishedAt: sn.publishedAt || null,
      durationSec: Number(item.contentDetails?.lengthSeconds) || 0,
      thumbnail: sn.thumbnails?.high?.url || sn.thumbnails?.default?.url || null
    },
    metrics: {
      views: toNumber(st.viewCount),
      likes: toNumber(st.likeCount),
      comments: toNumber(st.commentCount),
      favorites: toNumber(st.favoriteCount)
    },
    unavailable: UNAVAILABLE
  };
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchRumble(url) {
  return {
    ok: false,
    verified: false,
    error: 'no_public_api',
    message: 'Rumble does not publish a public statistics API. Verified view/like counts cannot be read by this app.',
    hint: 'Use the Rumble Studio dashboard for owner analytics. This app will not display guessed numbers.'
  };
}

async function getAnalytics(rawUrl, { refresh = false } = {}) {
  const validation = validateVideoUrl(rawUrl);
  if (!validation.ok) {
    return { ok: false, verified: false, error: validation.reason || 'invalid_url', message: 'Enter a valid YouTube or Rumble video URL.' };
  }
  const { platform, videoId } = validation;
  const key = cacheKey(platform, videoId);
  const cache = getCache();
  const cached = cache[key];

  if (!refresh && cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
    return Object.assign({}, cached, { cached: true });
  }

  let result;
  try {
    result = platform === 'youtube' ? await fetchYouTube(videoId) : await fetchRumble(validation.normalized);
  } catch (err) {
    log.warn('[analytics] fetch failed: ' + err.message);
    result = {
      ok: false,
      verified: false,
      error: 'network_error',
      message: 'Could not reach the platform API. Check the connection and retry.'
    };
  }

  result.platform = platform;
  result.videoId = videoId;
  result.url = validation.normalized;
  result.checkedAt = new Date().toISOString();

  // Always label what the platform does not expose, even on errors.
  if (!result.unavailable) result.unavailable = Object.assign({}, UNAVAILABLE);

  if (result.ok) {
    const history = Array.isArray(cached?.history) ? cached.history.slice(-HISTORY_LIMIT) : [];
    const last = history[history.length - 1];
    const point = { ts: result.fetchedAt, views: result.metrics.views, likes: result.metrics.likes, comments: result.metrics.comments };
    if (!last || last.views !== point.views || last.likes !== point.likes || last.comments !== point.comments) {
      history.push(point);
    }
    result.history = history.slice(-HISTORY_LIMIT);
    cache[key] = result;
    saveCache(cache);
  }

  return result;
}

function getHistory(rawUrl) {
  const validation = validateVideoUrl(rawUrl);
  if (!validation.ok) return { ok: false, error: validation.reason, history: [] };
  const cached = getCache()[cacheKey(validation.platform, validation.videoId)];
  return {
    ok: true,
    platform: validation.platform,
    videoId: validation.videoId,
    fetchedAt: cached?.fetchedAt || null,
    history: Array.isArray(cached?.history) ? cached.history : []
  };
}

// --- Organic growth helpers (local, honest recommendations) -------------
function growthSuggestions(analysis) {
  const suggestions = [];
  if (!analysis || !analysis.ok) return suggestions;
  const title = analysis.video?.title || '';
  const views = analysis.metrics?.views ?? 0;
  const likes = analysis.metrics?.likes ?? 0;
  const comments = analysis.metrics?.comments ?? 0;

  if (title.length > 0 && title.length < 30) {
    suggestions.push({ type: 'title', message: 'Your title is short. Aim for 40–70 characters with the main keyword first.' });
  }
  if (title.length > 100) {
    suggestions.push({ type: 'title', message: 'Your title is long. Front-load the key phrase so it is not cut off on mobile.' });
  }
  if (views > 0 && likes / views < 0.02) {
    suggestions.push({ type: 'engagement', message: 'Like ratio is under 2%. Add a clear call to action for likes at the start and end.' });
  }
  if (views > 0 && comments / views < 0.001) {
    suggestions.push({ type: 'engagement', message: 'Comment ratio is low. Ask one specific question in the video and pin a reply.' });
  }
  suggestions.push({ type: 'sharing', message: 'Share through the platform’s own share button so the link carries the correct attribution.' });
  suggestions.push({ type: 'schedule', message: 'Publish at a consistent time each week and check the platform’s own analytics for your audience’s active hours.' });
  return suggestions;
}

module.exports = { getAnalytics, getHistory, growthSuggestions, UNAVAILABLE };
