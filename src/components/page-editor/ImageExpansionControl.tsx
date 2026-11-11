import type { ContentBlock } from '../../types/contentBlocks';
import { IMAGE_EXPANSION_FIELDS } from '../blocks/imageExpansion';

export default function ImageExpansionControl({ block, onChange }: {
  block: ContentBlock;
  onChange: (updates: Record<string, string>) => void;
}) {
  const field = IMAGE_EXPANSION_FIELDS[block.block_type];
  if (!field) return null;
  const enabled = block.content[field] !== 'false';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange({ [field]: String(!enabled) })}
      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', margin: '10px 0', border: '1px solid #cbd5e1', borderRadius: '8px', background: enabled ? '#eff6ff' : '#f8fafc', color: '#0f172a', cursor: 'pointer', textAlign: 'left' }}
    >
      <span aria-hidden="true" style={{ width: '32px', height: '18px', padding: '2px', boxSizing: 'border-box', borderRadius: '12px', background: enabled ? '#0284c7' : '#94a3b8', flexShrink: 0 }}>
        <span style={{ display: 'block', width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transform: enabled ? 'translateX(14px)' : undefined }} />
      </span>
      Permitir ampliación de imagen
    </button>
  );
}
