/**
 * Video preview card for authorized platform embeds.
 * Uses the official YouTube iframe embed and the Rumble embed endpoint.
 * Autoplay is never forced — the platform's own policies apply.
 */
const QUALITY_LABEL = { auto: 'Auto', '1080p': '1080p', '720p': '720p', '480p': '480p', '360p': '360p' };

export function buildEmbedUrl(platform, videoId, url, { muted = true, quality = 'auto' } = {}) {
  if (platform === 'youtube' && videoId) {
    const params = new URLSearchParams({
      rel: '0',
      modestbranding: '1',
      playsinline: '1',
      mute: muted ? '1' : '0'
    });
    if (quality !== 'auto') params.set('vq', quality);
    return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?${params.toString()}` };
  }
  if (platform === 'rumble' && url) {
    const m = url.match(/rumble\.com\/(v[\w-]+)/i);
    const id = m ? m[1] : '';
    if (id) {
      return { kind: 'iframe', src: `https://rumble.com/embed/${encodeURIComponent(id)}/` };
    }
  }
  return { kind: 'link', src: url || null };
}

export function thumbnailFor(platform, videoId, info) {
  if (info?.thumbnail) return info.thumbnail;
  if (platform === 'youtube' && videoId) return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
  return null;
}

export default function VideoPreview({ session, platform, videoId, url, thumbnail, muted, quality, onPlay, onPause, onStop, onFullscreen }) {
  const isPreview = session.kind === 'preview';
  const embed = isPreview ? buildEmbedUrl(platform, videoId, url, { muted, quality }) : null;
  const progress = Number.isFinite(session.progress) ? session.progress : 0;
  const remaining = Math.max(0, (session.durationSec || 0) - (session.elapsedSec || 0));

  return (
    <article className={`preview-card glass status-${session.status}`}>
      <div className="preview-frame">
        {isPreview && embed && embed.kind === 'iframe' && session.status !== 'queued' ? (
          <iframe
            src={embed.src}
            title={`Preview session ${session.id}`}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <div className="preview-placeholder">
            {thumbnail ? <img src={thumbnail} alt="" loading="lazy" /> : <span className="preview-glyph">{isPreview ? '▶' : '⌁'}</span>}
            {!isPreview && <span className="preview-kind-tag">simulated</span>}
          </div>
        )}
      </div>

      <div className="preview-body">
        <div className="preview-head">
          <span className="preview-id">{session.id}</span>
          <span className={`tag tag-${session.status}`}>{session.status}</span>
          <span className="preview-kind">{isPreview ? 'preview' : 'background'}</span>
        </div>

        <div className="progress-track" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-fill" style={{ width: `${Math.min(100, progress)}%` }} />
        </div>

        <div className="preview-meta">
          <span>{formatSec(session.elapsedSec)} elapsed</span>
          <span>{formatSec(remaining)} left</span>
          <span>{Math.round(progress)}%</span>
        </div>

        {session.error && <div className="preview-error">Error: {session.error.replace(/_/g, ' ')}</div>}

        <div className="preview-actions">
          <button className="btn small" onClick={() => onPlay(session)} disabled={!isPreview || session.status === 'running'}>Play</button>
          <button className="btn small" onClick={() => onPause(session)} disabled={session.status !== 'running'}>Pause</button>
          <button className="btn small danger" onClick={() => onStop(session)} disabled={!['running', 'paused', 'queued'].includes(session.status)}>Stop</button>
          <button className="btn small" onClick={() => onFullscreen(session)} disabled={!isPreview}>Full</button>
        </div>
      </div>
    </article>
  );
}

function formatSec(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export { QUALITY_LABEL };
