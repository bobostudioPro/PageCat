import { useToast } from '../../state/toast';

export function Toasts() {
  const { toasts, dismiss } = useToast();
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <button key={toast.id} className={`toast ${toast.tone ?? ''}`} onClick={() => dismiss(toast.id)}>
          {toast.text}
        </button>
      ))}
    </div>
  );
}
