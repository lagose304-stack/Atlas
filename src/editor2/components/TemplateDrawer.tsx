import React, { useEffect, useState } from 'react';
import { BookmarkPlus, Layers, Paintbrush, Plus, Trash2, X } from 'lucide-react';
import type { PlacedBlock } from '../domain/schema';
import { ATLAS_SECTION_TEMPLATES } from '../domain/templates';
import {
  editor2Api,
  type Editor2SectionTemplateRecord,
  type Editor2StylePresetRecord,
} from '../services/editor2Api';
import { useEditor2Store } from '../store/editor2Store';

export type TemplateDrawerProps = {
  open: boolean;
  initialSectionId?: string;
  onClose: () => void;
};

function rekeySectionIds(section: PlacedBlock): PlacedBlock {
  const clone = JSON.parse(JSON.stringify(section)) as Record<string, unknown>;
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    const obj = node as Record<string, unknown>;
    if (typeof obj.id === 'string' && typeof obj.type === 'string') {
      obj.id = crypto.randomUUID();
    }
    for (const val of Object.values(obj)) {
      walk(val);
    }
  };
  walk(clone);
  return clone as unknown as PlacedBlock;
}

const TemplateDrawer: React.FC<TemplateDrawerProps> = ({ open, onClose, initialSectionId }) => {
  const [tab, setTab] = useState<'templates' | 'presets'>('templates');
  const [savedTemplates, setSavedTemplates] = useState<Editor2SectionTemplateRecord[]>([]);
  const [savedPresets, setSavedPresets] = useState<Editor2StylePresetRecord[]>([]);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doc = useEditor2Store((state) => state.doc);
  const [sectionId, setSectionId] = useState('');
  const sections = doc?.root.slots.children ?? [];
  const selectedSection = sections.find(({ block }) => block.id === sectionId);
  const copiedStyle = useEditor2Store((state) => state.copiedStyle);
  const appendSection = useEditor2Store((state) => state.appendSection);
  const copyBlockStyle = useEditor2Store((state) => state.copyBlockStyle);

  useEffect(() => {
    if (!open) return;
    setSectionId(initialSectionId ?? '');
    if (initialSectionId) setTab('templates');
    let active = true;
    setFeedback(null);
    editor2Api
      .listTemplates()
      .then((rows) => {
        if (active) setSavedTemplates(rows);
      })
      .catch(() => {
        // Si aún no se ejecuta 002_presets_templates.sql, el catálogo integrado funciona igual.
      });
    editor2Api
      .listPresets()
      .then((rows) => {
        if (active) setSavedPresets(rows);
      })
      .catch(() => {
        // Idem para presets.
      });
    return () => {
      active = false;
    };
  }, [open, initialSectionId]);

  if (!open) return null;

  const handleInsertBuiltIn = (builder: () => PlacedBlock, name: string) => {
    appendSection(builder());
    setFeedback(`Plantilla «${name}» añadida al final de la página.`);
  };

  const handleInsertSaved = (record: Editor2SectionTemplateRecord) => {
    appendSection(rekeySectionIds(record.section));
    setFeedback(`Plantilla «${record.name}» añadida al final de la página.`);
  };

  const handleSaveSection = async () => {
    if (!selectedSection || !newTemplateName.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const saved = await editor2Api.saveTemplate({
        name: newTemplateName.trim(),
        category: 'Personalizada',
        description: 'Sección guardada desde Editor 2.0',
        section: selectedSection,
      });
      setSavedTemplates((prev) => [saved, ...prev]);
      setNewTemplateName('');
      setFeedback(`Plantilla «${saved.name}» guardada en Supabase.`);
    } catch {
      setFeedback('No se pudo guardar la plantilla (verifica que 002_presets_templates.sql esté aplicado).');
    } finally {
      setBusy(false);
    }
  };

  const handleSaveCopiedPreset = async () => {
    if (!copiedStyle || !newPresetName.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const saved = await editor2Api.savePreset(newPresetName.trim(), copiedStyle);
      setSavedPresets((prev) => [saved, ...prev]);
      setNewPresetName('');
      setFeedback(`Preset «${saved.name}» guardado en Supabase.`);
    } catch {
      setFeedback('No se pudo guardar el preset (verifica que 002_presets_templates.sql esté aplicado).');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await editor2Api.deleteTemplate(id);
      setSavedTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setFeedback('No se pudo eliminar la plantilla.');
    }
  };

  const handleDeletePreset = async (id: string) => {
    try {
      await editor2Api.deletePreset(id);
      setSavedPresets((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setFeedback('No se pudo eliminar el preset.');
    }
  };

  return (
    <div
      className="e2-drawer-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Biblioteca de plantillas y presets"
      onClick={onClose}
    >
      <aside className="e2-version-drawer e2-theme-drawer" onClick={(e) => e.stopPropagation()}>
        <header className="e2-version-drawer__head">
          <div className="e2-version-drawer__title">
            <Layers size={16} aria-hidden="true" />
            <h2>Plantillas y presets</h2>
          </div>
          <button type="button" className="e2-icon-button" aria-label="Cerrar biblioteca" onClick={onClose}>
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="e2-theme-drawer__body">
          <div className="e2-segmented" role="tablist" aria-label="Secciones de biblioteca">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'templates'}
              className={tab === 'templates' ? 'is-active' : undefined}
              onClick={() => setTab('templates')}
            >
              Plantillas de sección
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'presets'}
              className={tab === 'presets' ? 'is-active' : undefined}
              onClick={() => setTab('presets')}
            >
              Presets de estilo
            </button>
          </div>

          {feedback && (
            <p className="e2-template-feedback" role="status">
              {feedback}
            </p>
          )}

          {tab === 'templates' ? (
            <>
              <p className="e2-theme-drawer__intro">
                Inserta una composición lista en 1 clic. Cada bloque interno es 100 % editable y movible.
              </p>
              <div className="e2-template-list">
                {ATLAS_SECTION_TEMPLATES.map((tpl) => (
                  <article key={tpl.id} className="e2-template-card">
                    <div className="e2-template-card__meta">
                      <span className="e2-template-card__cat">{tpl.category}</span>
                      <strong>{tpl.name}</strong>
                      <p>{tpl.description}</p>
                    </div>
                    <button
                      type="button"
                      className="e2-button e2-button--primary"
                      onClick={() => handleInsertBuiltIn(tpl.build, tpl.name)}
                    >
                      <Plus size={13} aria-hidden="true" />
                      <span>Insertar</span>
                    </button>
                  </article>
                ))}
              </div>

              <div className="e2-template-save-box">
                <strong className="e2-design-label">Guardar sección como plantilla</strong>
                <select aria-label="Sección para guardar" value={selectedSection?.block.id ?? ''} onChange={(event) => setSectionId(event.target.value)}>
                  <option value="">Elige una sección</option>
                  {sections.map(({ block }, index) => (
                    <option key={block.id} value={block.id}>Sección {index + 1}</option>
                  ))}
                </select>
                <div className="e2-version-drawer__create">
                  <input
                    type="text"
                    aria-label="Nombre de la nueva plantilla"
                    placeholder="Ej. Ficha de epitelios"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="e2-button e2-button--quiet"
                    disabled={busy || !newTemplateName.trim() || !selectedSection}
                    onClick={() => void handleSaveSection()}
                  >
                    <BookmarkPlus size={14} aria-hidden="true" />
                    <span>Guardar</span>
                  </button>
                </div>
              </div>

              {savedTemplates.length > 0 && (
                <div className="e2-template-list">
                  <strong className="e2-design-label">Tus plantillas guardadas</strong>
                  {savedTemplates.map((rec) => (
                    <article key={rec.id} className="e2-template-card">
                      <div className="e2-template-card__meta">
                        <span className="e2-template-card__cat">{rec.category}</span>
                        <strong>{rec.name}</strong>
                      </div>
                      <div className="e2-version-item__actions">
                        <button
                          type="button"
                          className="e2-button e2-button--quiet"
                          onClick={() => handleInsertSaved(rec)}
                        >
                          <Plus size={13} aria-hidden="true" />
                          <span>Insertar</span>
                        </button>
                        <button
                          type="button"
                          className="e2-icon-button"
                          aria-label={`Eliminar plantilla ${rec.name}`}
                          onClick={() => void handleDeleteTemplate(rec.id)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="e2-theme-drawer__intro">
                Copia el estilo de cualquier bloque con la brocha (<span className="e2-mono">Ctrl+Alt+C</span>) y guárdalo aquí para reutilizarlo en otras páginas.
              </p>
              <div className="e2-template-save-box">
                <strong className="e2-design-label">Guardar estilo copiado como preset</strong>
                <div className="e2-version-drawer__create">
                  <input
                    type="text"
                    aria-label="Nombre del nuevo preset"
                    placeholder="Ej. Tarjeta clínica verde"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                  />
                  <button
                    type="button"
                    className="e2-button e2-button--quiet"
                    disabled={busy || !copiedStyle || !newPresetName.trim()}
                    onClick={() => void handleSaveCopiedPreset()}
                  >
                    <BookmarkPlus size={14} aria-hidden="true" />
                    <span>Guardar</span>
                  </button>
                </div>
              </div>

              {savedPresets.length === 0 ? (
                <p className="e2-version-drawer__empty">Aún no tienes presets de estilo guardados.</p>
              ) : (
                <div className="e2-template-list">
                  {savedPresets.map((preset) => (
                    <article key={preset.id} className="e2-template-card">
                      <div className="e2-template-card__meta">
                        <strong>{preset.name}</strong>
                      </div>
                      <div className="e2-version-item__actions">
                        <button
                          type="button"
                          className="e2-button e2-button--quiet"
                          onClick={() => {
                            copyBlockStyle(preset.style);
                            setFeedback(`Estilo «${preset.name}» cargado en la brocha. Pulsa Pegar estilo en cualquier bloque.`);
                          }}
                        >
                          <Paintbrush size={13} aria-hidden="true" />
                          <span>Cargar</span>
                        </button>
                        <button
                          type="button"
                          className="e2-icon-button"
                          aria-label={`Eliminar preset ${preset.name}`}
                          onClick={() => void handleDeletePreset(preset.id)}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

export default TemplateDrawer;
