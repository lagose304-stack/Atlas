import React, { useMemo, useState } from 'react';
import { FileText, FlaskConical, Home, Layers3, PanelLeftClose, Search } from 'lucide-react';

export type PageSelection =
  | { kind: 'home'; label: string }
  | { kind: 'temario'; label: string }
  | { kind: 'tema'; id: number; label: string }
  | { kind: 'subtema'; id: number; temaId: number; label: string; parentLabel: string };

export interface EditorTemaItem {
  id: number;
  nombre: string;
  parcial: string;
  sort_order?: number | null;
}

export interface EditorSubtemaItem {
  id: number;
  nombre: string;
  tema_id: number;
  sort_order?: number | null;
}

interface PageNavigatorProps {
  selection: PageSelection;
  temas: EditorTemaItem[];
  subtemas: EditorSubtemaItem[];
  loading: boolean;
  onSelect: (selection: PageSelection) => void;
  onClose?: () => void;
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const PageNavigator: React.FC<PageNavigatorProps> = ({ selection, temas, subtemas, loading, onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const normalizedSearch = normalize(search.trim());

  const filteredTemas = useMemo(() => temas.filter(tema => {
    if (!normalizedSearch) return true;
    if (normalize(tema.nombre).includes(normalizedSearch)) return true;
    return subtemas.some(subtema => subtema.tema_id === tema.id && normalize(subtema.nombre).includes(normalizedSearch));
  }), [normalizedSearch, subtemas, temas]);

  return (
    <aside className="page-editor-nav" aria-label="Páginas editables">
      <div className="page-editor-nav-heading">
        <div className="page-editor-nav-heading-row">
          <span className="page-editor-eyebrow">Contenido del sitio</span>
          {onClose && <button type="button" onClick={onClose} title="Ocultar selector de páginas" aria-label="Ocultar selector de páginas"><PanelLeftClose size={18} /></button>}
        </div>
        <h2>Páginas</h2>
        <p>Selecciona una página para editarla.</p>
      </div>

      <label className="page-editor-search">
        <Search size={17} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Buscar tema o subtema"
          aria-label="Buscar tema o subtema"
        />
      </label>

      <nav className="page-editor-nav-list">
        <button
          type="button"
          className={`page-editor-nav-item ${selection.kind === 'home' ? 'is-active' : ''}`}
          onClick={() => onSelect({ kind: 'home', label: 'Inicio' })}
        >
          <Home size={18} />
          <span><strong>Inicio</strong><small>Portada pública</small></span>
        </button>
        <button
          type="button"
          className={`page-editor-nav-item ${selection.kind === 'temario' ? 'is-active' : ''}`}
          onClick={() => onSelect({ kind: 'temario', label: 'Temario' })}
        >
          <Layers3 size={18} />
          <span><strong>Temario</strong><small>Catálogo general</small></span>
        </button>

        <div className="page-editor-tree-label"><FlaskConical size={15} /> Temas y subtemas</div>
        {loading ? (
          <div className="page-editor-nav-empty">Cargando páginas…</div>
        ) : filteredTemas.length === 0 ? (
          <div className="page-editor-nav-empty">No se encontraron resultados.</div>
        ) : filteredTemas.map(tema => {
          const children = subtemas.filter(subtema => subtema.tema_id === tema.id && (
            !normalizedSearch || normalize(tema.nombre).includes(normalizedSearch) || normalize(subtema.nombre).includes(normalizedSearch)
          ));
          return (
            <div className="page-editor-tree-group" key={tema.id}>
              <button
                type="button"
                className={`page-editor-tree-item tema ${selection.kind === 'tema' && selection.id === tema.id ? 'is-active' : ''}`}
                onClick={() => onSelect({ kind: 'tema', id: tema.id, label: tema.nombre })}
              >
                <FileText size={16} />
                <span>{tema.nombre}</span>
              </button>
              {children.map(subtema => (
                <button
                  type="button"
                  key={subtema.id}
                  className={`page-editor-tree-item subtema ${selection.kind === 'subtema' && selection.id === subtema.id ? 'is-active' : ''}`}
                  onClick={() => onSelect({
                    kind: 'subtema',
                    id: subtema.id,
                    temaId: tema.id,
                    label: subtema.nombre,
                    parentLabel: tema.nombre,
                  })}
                >
                  <span className="page-editor-tree-line" aria-hidden="true" />
                  <span>{subtema.nombre}</span>
                </button>
              ))}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};

export default PageNavigator;
