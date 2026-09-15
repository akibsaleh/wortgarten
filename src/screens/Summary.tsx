import { useNavigate } from 'react-router-dom';
import { useSessionStore } from '../store/session';

export function Summary() {
  const navigate = useNavigate();
  const { reviewed, correct, startedAt, reset } = useSessionStore();

  const elapsed = startedAt ? Math.round((Date.now() - startedAt) / 1000) : 0;
  const min = Math.floor(elapsed / 60);
  const sec = elapsed % 60;
  const retention = reviewed > 0 ? Math.round((correct / reviewed) * 100) : 0;

  function handleDone() {
    reset();
    navigate('/');
  }

  return (
    <main className="summary">
      <div className="summary-ripple" aria-hidden="true" />
      <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '31px', color: 'var(--color-ink)' }}>
        Session complete
      </h2>

      <div className="summary-stats">
        <div className="stat">
          <span className="stat-value">{reviewed}</span>
          <span className="stat-label">cards reviewed</span>
        </div>
        <div className="stat">
          <span className="stat-value">{retention}%</span>
          <span className="stat-label">retention</span>
        </div>
        <div className="stat">
          <span className="stat-value">{min}:{sec.toString().padStart(2, '0')}</span>
          <span className="stat-label">time</span>
        </div>
      </div>

      <button onClick={handleDone} className="btn-primary">
        Done
      </button>
    </main>
  );
}
