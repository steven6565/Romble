// Platform integration: YouTube + Rumble.
// YouTube metadata comes from the official YouTube Data API v3 when a key is
// provided, falling back to public Invidious instances. Rumble metadata is
// fetched via yt-dlp (`pkg install yt-dlp` on Termux) or a generic page scrape.
// Every method returns a "source" label so the UI never fakes platform stats.
const { execFile } = require('child_process');
const { promisify } = require('util');
const { loadEnv } = require('./env');
const log = require('./logService');

loadEnv();
const execFileAsync = promisify(execFile);

const YT_ID_PATTERNS = [
  /youtube\.com\/watch\?(?:[^#&]*&)?v=([A-Za-z0-9_-]{11})/i,
  /youtube\.com\/(?:shorts|live|embed|v)\/([A-Za-z0-9_-]{11})/i,
  /youtu\.be\/([A-Za-z0-9_-]{11})/i,
  /youtube\.com\/([A-Za-z0-9_-]{11})/i
];

const RUMBLE_RE = /^https?:\/\/(?:www\.)?rumble\.com\/[\w.-]{2,}(?:\/[\w.-]+)*\/?$/i;

function extractYouTubeId(url) {
  for (const re of YT_ID_PATTERNS) {
    const m = url.match(re);
    if (m && m[1]) return m[1];
  }
  return null;
}

function isRumbleUrl(url) {
  return RUMBLE_RE.test(url);
}

function validateVideoUrl(url) {
  if (typeof url !== 'string') {
    return { ok: false, reason: 'missing_url', platform: null, videoId: null, normalized: null };
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return { ok: false, reason: 'missing_url', platform: null, videoId: null, normalized: null };
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return { ok: false, reason: 'invalid_url_scheme', platform: null, videoId: null, normalized: trimmed };
  }
  const ytId = extractYouTubeId(trimmed);
  if (ytId) {
    return { ok: true, reason: null, platform: 'youtube', videoId: ytId, normalized: trimmed };
  }
  if (isRumbleUrl(trimmed)) {
    return { ok: true, reason: null, platform: 'rumble', videoId: trimmed.split('/').pop().replace(/[^A-Za-z0-9._-]+/g, '') || trimmed, normalized: trimmed };
  }
  return { ok: false, reason: 'unsupported_platform', platform: null, videoId: null, normalized: trimmed };
}

async function youtubeMetadata(id) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${encodeURIComponent(id)}&key=${encodeURIComponent(apiKey)}`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (res.ok) {
        const data = await res.json();
        const item = (data.items || [])[0];
        if (item) {
          const sn = item.snippet || {};
          const cd = item.contentDetails || {};
          const st = item.statistics || {};
          return {
            title: sn.title || null,
            description: sn.description || null,
            durationSec: Number(cd.lengthSeconds) || 0,
            views: Number(st.viewCount) || 0,
            likes: Number(st.likeCount) || 0,
            source: 'youtube_api'
          };
        }
        log.warn('[platform] YouTube API: video not found');
      } else {
        log.warn(`[platform] YouTube API returned HTTP ${res.status}`);
      }
    } catch (err) {
      log.warn('[platform] YouTube API error: ' + err.message);
    }
  }

  const instance = (process.env.INVIDIOUS_INSTANCE || 'https://yewtu.be').replace(/\/+$/, '');
  try {
    const res = await fetch(`${instance}/api/v1/videos/${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'Youtube-Rumble-Termux/4.0 (+https://127.0.0.1)' }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || null,
        description: data.description || null,
        durationSec: Number(data.lengthSeconds) || 0,
        views: Number(data.views) || 0,
        likes: Number(data.likes) || 0,
        source: 'invidious'
      };
    }
    log.warn(`[platform] Invidious returned HTTP ${res.status}`);
  } catch (err) {
    log.warn('[platform] Invidious error: ' + err.message);
  }
  throw new Error('youtube_metadata_unavailable');
}

async function rumbleMetadata(url) {
  // 1) yt-dlp (recommended: pkg install yt-dlp on Termux)
  try {
    const { stdout } = await execFileAsync('yt-dlp', ['-J', '--no-playlist', url], { timeout: 15000 });
    const data = JSON.parse(stdout);
    return {
      title: data.title || null,
      description: data.description || null,
      durationSec: Math.round(Number(data.duration) || 0),
      views: Number(data.view_count) || 0,
      likes: Number(data.like_count) || 0,
      source: 'yt-dlp'
    };
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      log.debug('[platform] yt-dlp not installed — run `pkg install yt-dlp` for full Rumble metadata');
    } else if (!(err && err.killed) && err && err.message) {
      log.debug('[platform] yt-dlp failed: ' + err.message.split('\n')[0]);
    }
  }

  // 2) Fallback: parse the video page title
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36' }
    });
    if (res.ok) {
      const html = await res.text();
      const m = html.match(/<title[^>]*>([^<]+?)<\/title>/i);
      return {
        title: m ? m[1].trim().replace(/\s+/g, ' ') : null,
        description: null,
        durationSec: 0,
        views: 0,
        source: 'rumble_page_scrape'
      };
    }
    log.warn(`[platform] Rumble page returned HTTP ${res.status}`);
  } catch (err) {
    log.warn('[platform] Rumble page fetch error: ' + err.message);
  }
  throw new Error('rumble_metadata_unavailable');
}

async function getVideoMetadata(url, platform) {
  if (platform === 'youtube') return youtubeMetadata(extractYouTubeId(url));
  if (platform === 'rumble') return rumbleMetadata(url);
  throw new Error('unsupported_platform');
}

async function probePlatformStatus() {
  // Returns connection status for both platforms without faking anything.
  const status = { checkedAt: new Date().toISOString(), youtube: false, rumble: false };
  try {
    const res = await fetch('https://www.googleapis.com/youtube/v3/', { signal: AbortSignal.timeout(6000) });
    status.youtube = res.ok || res.status === 403; // API reachable if it answers
  } catch { /* network/TLS failure = offline */ }
  try {
    const res = await fetch('https://rumble.com/', { signal: AbortSignal.timeout(6000), method: 'GET' });
    status.rumble = res.status >= 200 && res.status < 500;
  } catch { /* offline */ }
  return status;
}

module.exports = {
  validateVideoUrl,
  extractYouTubeId,
  isRumbleUrl,
  getVideoMetadata,
  probePlatformStatus
};
