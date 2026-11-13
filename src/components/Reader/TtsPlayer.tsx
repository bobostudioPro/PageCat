import { Pause, Play, Square, Volume2 } from 'lucide-react';
import { useTts } from '../../state/tts';

export function TtsPlayer() {
  const { speaking, paused, label, error, pause, resume, stop } = useTts();
  if (!speaking && !error) return null;
  return (
    <div className={`tts-player ${error ? 'is-error' : ''}`} role="status" aria-live="polite">
      <span className="tts-player-mark">
        <Volume2 size={15} />
      </span>
      <span className="tts-player-copy">
        <strong>{error ?? label}</strong>
        {!error && <em>{paused ? '已暂停' : '正在朗读'}</em>}
      </span>
      {!error && (
        <div className="tts-player-actions">
          <button onClick={() => (paused ? resume() : pause())} aria-label={paused ? '继续朗读' : '暂停朗读'} title={paused ? '继续' : '暂停'}>
            {paused ? <Play size={14} /> : <Pause size={14} />}
          </button>
          <button onClick={stop} aria-label="停止朗读" title="停止">
            <Square size={13} />
          </button>
        </div>
      )}
      {error && (
        <button className="tts-player-close" onClick={stop} aria-label="关闭">
          ×
        </button>
      )}
    </div>
  );
}
