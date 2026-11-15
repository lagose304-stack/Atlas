import { useEffect, useId, useState, type InputHTMLAttributes } from 'react';
import { Eye } from 'lucide-react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string };

export default function HoldToRevealCodeInput({ label, value, disabled, id, ...inputProps }: Props) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  useEffect(() => { setVisible(false); }, [value, disabled]);

  useEffect(() => {
    const hide = () => setVisible(false);
    const releaseKey = (event: KeyboardEvent) => {
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') hide();
    };
    window.addEventListener('pointerup', hide);
    window.addEventListener('pointercancel', hide);
    window.addEventListener('blur', hide);
    window.addEventListener('keyup', releaseKey);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pointerup', hide);
      window.removeEventListener('pointercancel', hide);
      window.removeEventListener('blur', hide);
      window.removeEventListener('keyup', releaseKey);
      document.removeEventListener('visibilitychange', hide);
    };
  }, []);

  return <div className="instructor-label">
    <label htmlFor={inputId}>{label}</label>
    <div className="instructor-code-group">
      <input {...inputProps} id={inputId} value={value} disabled={disabled}
        className="instructor-input instructor-code" type={visible && !disabled ? 'text' : 'password'} />
      <button type="button" className="instructor-btn instructor-code-reveal" disabled={disabled}
        aria-label="Mantén presionado para ver el código" aria-controls={inputId} aria-pressed={visible && !disabled}
        title="Mantén presionado para ver el código"
        onPointerDown={event => {
          if (event.button === 0 && event.isPrimary !== false) setVisible(true);
        }}
        onPointerUp={() => setVisible(false)} onPointerCancel={() => setVisible(false)}
        onPointerLeave={() => setVisible(false)} onLostPointerCapture={() => setVisible(false)}
        onBlur={() => setVisible(false)}
        onKeyDown={event => {
          if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setVisible(true); }
          if (event.key === 'Escape') setVisible(false);
        }}
        onKeyUp={event => {
          if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); setVisible(false); }
        }}
        onClick={event => event.preventDefault()} onContextMenu={event => event.preventDefault()}
      ><Eye size={20} aria-hidden="true" /></button>
    </div>
  </div>;
}
