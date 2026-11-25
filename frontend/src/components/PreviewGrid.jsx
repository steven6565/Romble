// Orchestrates preview rendering, session controls and fullscreen previews.
import { useCallback, useRef, useState } from 'react';
import VideoPreview, { buildEmbedUrl, thumbnailFor } from './VideoPreview.jsx';

export default function PreviewGrid({ run, info, controls }) {
  const [fullscreenId, setFullscreenId] = useState(null);
  const gridRef = useRef(null);

  const onFullscreen = useCallback((session) => setFullscreenId(session.id), []);

  if (!run) {
    return (
      <div className="card glass empty-state">
        <span className="empty-glyph">▶</span>
        <h3>No playback test running</h3>
        <p className="muted">Configure a test above and press Start. Preview screens use the platform’s official embed; background sessions are local timers only.</p>
      </div>
    );
  }

  const sessions = run.sessions || [];
  const previews = sessions.filter((s) => s.kind === 'preview');
  const background = sessions.filter((s) => s.kind === 'background');
  const config = run.config || {};
  const thumbnail = thumbnailFor(config.platform, config.videoId, info);
  const fullscreenSession = sessions.find((s) => s.id === fullscreenId) || null;
  const fullscreenEmbed = fullscreenSession ? buildEmbedUrl(config.platform, config.videoId, config.videoUrl, { muted: config.muted, quality: config.quality }) : null;

  return (
    <>
      <div className="preview-grid" ref={gridRef} data-count={previews.length}>
        {previews.map((s) => (
          <VideoPreview
            key={s.id}
            session={s}
            platform={config.platform}
            videoId={config.videoId}
            url={config.videoUrl}
            thumbnail={thumbnail}
            muted={config.muted}
            quality={config.quality}
            onPlay={controls.play}
            onPause={controls.pause}
            onStop={controls.stop}
            onFullscreen={onFullscreen}
          />
        ))}
      </div>

      {background.length > 0 && (
        <div className="card glass">
          <div className="background-head">
            <h3 className="section-title" style={{ margin: 0 }}>Background test sessions</h3>
            <span className="badge-sim">simulated · no platform requests</span>
          </div>
          <p className="muted small-text">
            These {background.length} sessions run as local timers only. They are not viewers and cannot produce views, likes or comments.
          </p>
          <div className="background-chips">
            {background.slice(0, 60).map((s) => (
              <span key={s.id} className={`chip chip-${s.status}`} title={`${s.id} · ${s.status}`}>
                {s.id}
                <em>{Math.round(s.progress || 0)}%</em>
              </span>
            ))}
            {background.length > 60 && <span className="chip">+{background.length - 60} more</span>}
          </div>
        </div>
      )}

      {fullscreenSession && fullscreenEmbed && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" onClick={() => setFullscreenId(null)}>
          <div className="modal-body" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span>{fullscreenSession.id} · fullscreen preview</span>
              <button className="btn small" onClick={() => setFullscreenId(null)}>Close</button>
            </div>
            {fullscreenEmbed.kind === 'iframe' ? (
              <iframe
                src={fullscreenEmbed.src}
                title="Fullscreen preview"
                allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <p className="muted">This URL cannot be embedded with an official player.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
