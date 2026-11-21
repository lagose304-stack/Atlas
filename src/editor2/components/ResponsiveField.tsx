import { cloneElement, useId, useRef, type ReactElement, type SelectHTMLAttributes } from 'react';
import { RotateCcw } from 'lucide-react';
import type { ScreenSize } from '../domain/responsive';

type ResponsiveFieldProps = {
  label: string;
  screen: ScreenSize;
  customized?: boolean;
  onReset: () => void;
  children: ReactElement<SelectHTMLAttributes<HTMLSelectElement>>;
};

export function ResponsiveField({ label, screen, customized, onReset, children }: ResponsiveFieldProps) {
  const statusId = useId();
  const control = useRef<HTMLLabelElement>(null);
  return (
    <div className="e2-responsive-field">
      <label ref={control}>{label}{cloneElement(children, { 'aria-describedby': statusId })}</label>
      <div className="e2-responsive-field__status">
        <span id={statusId}>{screen === 'desktop' ? 'Valor base' : customized ? 'Específico' : 'Heredado'}</span>
        {screen !== 'desktop' && customized && (
          <button
            type="button"
            className="e2-button e2-button--quiet"
            aria-label={`Restablecer ${label.toLowerCase()} al valor heredado`}
            title="Restablecer al valor heredado"
            onClick={() => {
              onReset();
              control.current?.querySelector('select')?.focus();
            }}
          >
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
