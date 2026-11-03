import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, RefreshCw } from 'lucide-react';

type Edge = 'left' | 'right' | 'top' | 'bottom' | 'auto';

export function AnnotationDirectionPicker({ value, onChange }: { value: Edge; onChange: (edge: Edge) => void }) {
  return <section className="annotation-option-direction" aria-label="Origen del puntero">
    <div className="annotation-option-heading">Origen de la aguja o flecha</div>
    <p>Elige desde qué lado de la imagen llega el puntero.</p>
    <div className="annotation-option-compass">
      {([
        { value: 'top', label: 'Arriba', title: 'Borde Superior', icon: ArrowUp },
        { value: 'left', label: 'Izquierda', title: 'Borde Izquierdo', icon: ArrowLeft },
        { value: 'auto', label: 'Auto', title: 'Borde Automático (más cercano)', icon: RefreshCw },
        { value: 'right', label: 'Derecha', title: 'Borde Derecho', icon: ArrowRight },
        { value: 'bottom', label: 'Abajo', title: 'Borde Inferior', icon: ArrowDown },
      ] as const).map(edge => <button key={edge.value} className={`annotation-option-compass__${edge.value}`} type="button" title={edge.title} aria-pressed={value === edge.value} onClick={() => onChange(edge.value)}>
        <edge.icon size={16} /><span>{edge.label}</span>
      </button>)}
    </div>
    <small>{value === 'auto' ? 'Automático: usa el borde más cercano al punto.' : 'El origen queda fijo en el lado seleccionado.'}</small>
  </section>;
}

export function AnnotationColorPicker({ colors, value, onChange }: { colors: { name: string; hex: string }[]; value: string; onChange: (color: string) => void }) {
  const selected = colors.find(color => color.hex === value);
  return <div className="annotation-option-colors">
    <div className="annotation-option-color-label"><span>Color de región:</span><span>{selected?.name ?? 'Personalizado'}</span></div>
    <div role="group" aria-label="Colores de la región">
      {colors.map(color => <button key={color.hex} type="button" title={color.name} aria-label={color.name} aria-pressed={value === color.hex} onClick={() => onChange(color.hex)} style={{ background: color.hex }}>
        {value === color.hex && <Check size={13} strokeWidth={3} />}
      </button>)}
    </div>
  </div>;
}
