import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Bell, DatabaseBackup, HardDrive, History, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { supabase } from '../services/supabase';
import {
  cleanStalePresence, DEFAULT_CONTROLS, downloadSiteBackup, fetchAdminSessions, fetchControlAudit,
  fetchRecentClientErrors, fetchSiteControls, getStorageInventory, revokeAdminSession, runSiteDiagnostics,
  saveSiteControls, type AdminSession, type AuditEntry, type DiagnosticItem, type SiteControls,
} from '../services/adminControlCenter';

const FEATURES = [
  { key: 'evaluations', label: 'Evaluaciones públicas' },
  { key: 'public_catalog', label: 'Temario y placas públicas' },
  { key: 'search', label: 'Buscador público' },
] as const;

const PARCIALES_LIST = [
  { key: 'primer', label: 'Primer parcial' },
  { key: 'segundo', label: 'Segundo parcial' },
  { key: 'tercer', label: 'Tercer parcial' },
] as const;

interface TemaControlItem {
  id: number;
  nombre: string;
  parcial: string;
  sort_order?: number;
}

const SiteControlCenter: React.FC = () => {
  const [controls, setControls] = useState<SiteControls>(DEFAULT_CONTROLS);
  const [saving, setSaving] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [errors, setErrors] = useState<AuditEntry[]>([]);
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof getStorageInventory>> | null>(null);
  const [message, setMessage] = useState('');

  // Control granular de temas
  const [temas, setTemas] = useState<TemaControlItem[]>([]);
  const [loadingTemas, setLoadingTemas] = useState(true);
  const [activeParcialTab, setActiveParcialTab] = useState<'primer' | 'segundo' | 'tercer'>('primer');
  const [searchTema, setSearchTema] = useState('');

  const refreshSecurity = async () => {
    const [nextSessions, nextAudit, nextErrors] = await Promise.all([fetchAdminSessions(), fetchControlAudit(), fetchRecentClientErrors()]);
    setSessions(nextSessions); setAudit(nextAudit); setErrors(nextErrors);
  };

  useEffect(() => {
    void fetchSiteControls().then(setControls);
    void refreshSecurity();

    // Cargar temas para el control granular
    const loadTemas = async () => {
      setLoadingTemas(true);
      const { data, error } = await supabase
        .from('temas')
        .select('id, nombre, parcial, sort_order')
        .order('sort_order', { ascending: true });
      if (!error && data) {
        setTemas(data as TemaControlItem[]);
      }
      setLoadingTemas(false);
    };
    void loadTemas();
  }, []);

  const saveControls = async () => {
    setSaving(true);
    const result = await saveSiteControls(controls);
    setSaving(false);
    setMessage(result.ok ? 'Configuración guardada correctamente.' : `No se pudo guardar: ${result.error}`);
    if (result.ok) void refreshSecurity();
  };

  const toggleFeature = (key: string) => setControls((current) => ({
    ...current,
    disabledFeatures: current.disabledFeatures.includes(key)
      ? current.disabledFeatures.filter((item) => item !== key)
      : [...current.disabledFeatures, key],
  }));

  const isParcialOff = (parcialKey: string) => controls.disabledFeatures.includes(`parcial_${parcialKey}`);
  const isTemaOff = (temaId: number) => controls.disabledFeatures.includes(`tema_${temaId}`);

  const toggleParcial = (parcialKey: string) => {
    const featureKey = `parcial_${parcialKey}`;
    toggleFeature(featureKey);
  };

  const toggleTema = (temaId: number) => {
    const featureKey = `tema_${temaId}`;
    toggleFeature(featureKey);
  };

  const setAllTemasInParcial = (parcialKey: string, enable: boolean) => {
    const temasInParcial = temas.filter((t) => t.parcial === parcialKey);
    const temaKeys = temasInParcial.map((t) => `tema_${t.id}`);
    const parcialFeatureKey = `parcial_${parcialKey}`;

    setControls((current) => {
      let nextDisabled = [...current.disabledFeatures];
      if (enable) {
        // Habilitar todos: remover parcial y temas de disabledFeatures
        nextDisabled = nextDisabled.filter((key) => key !== parcialFeatureKey && !temaKeys.includes(key));
      } else {
        // Deshabilitar todos: añadir los temas
        for (const tKey of temaKeys) {
          if (!nextDisabled.includes(tKey)) nextDisabled.push(tKey);
        }
      }
      return { ...current, disabledFeatures: nextDisabled };
    });
  };

  const filteredTemas = useMemo(() => {
    return temas.filter((t) => {
      const matchParcial = t.parcial === activeParcialTab;
      if (!matchParcial) return false;
      if (!searchTema.trim()) return true;
      return t.nombre.toLowerCase().includes(searchTema.toLowerCase().trim());
    });
  }, [temas, activeParcialTab, searchTema]);

  return (
    <section className="control-center">
      <div className="control-center-heading">
        <div><p>Administración avanzada</p><h2>Centro de control del sitio</h2></div>
        {message && <span role="status">{message}</span>}
      </div>

      <div className="control-center-grid">
        <details className="control-section" open>
          <summary><Bell size={20} /><span><b>Avisos y programación</b><small>Comunicación pública y mantenimiento programado</small></span></summary>
          <div className="control-section-body">
            <label className="control-check"><input type="checkbox" checked={controls.bannerEnabled} onChange={(e) => setControls({ ...controls, bannerEnabled: e.target.checked })} /> Mostrar aviso global</label>
            <textarea rows={2} maxLength={500} value={controls.bannerMessage} onChange={(e) => setControls({ ...controls, bannerMessage: e.target.value })} placeholder="Mensaje visible en todas las páginas públicas" />
            <div className="control-two-cols">
              <label>Inicio programado<input type="datetime-local" value={controls.maintenanceStartsAt} onChange={(e) => setControls({ ...controls, maintenanceStartsAt: e.target.value })} /></label>
              <label>Final programado<input type="datetime-local" value={controls.maintenanceEndsAt} onChange={(e) => setControls({ ...controls, maintenanceEndsAt: e.target.value })} /></label>
            </div>
            <button className="control-primary" disabled={saving} onClick={saveControls}>{saving ? 'Guardando…' : 'Guardar configuración'}</button>
          </div>
        </details>

        <details className="control-section control-section-wide" open>
          <summary><SlidersHorizontal size={20} /><span><b>Controles parciales y por tema</b><small>Desactiva funciones globales, parciales completos o temas específicos</small></span></summary>
          <div className="control-section-body">
            {/* 1. Funciones Globales */}
            <div>
              <h4 style={{ margin: '4px 0 8px', fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                Funciones públicas generales
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '8px' }}>
                {FEATURES.map((feature) => (
                  <label className="control-check" key={feature.key} style={{ padding: '8px 12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <input type="checkbox" checked={!controls.disabledFeatures.includes(feature.key)} onChange={() => toggleFeature(feature.key)} />
                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{feature.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Control de Parciales Completos */}
            <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                  Parciales completos
                </h4>
                <small style={{ color: '#64748b' }}>Desactivar un parcial oculta automáticamente todos sus temas y evaluaciones</small>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                {PARCIALES_LIST.map((p) => {
                  const isOff = isParcialOff(p.key);
                  const countTemas = temas.filter((t) => t.parcial === p.key).length;
                  return (
                    <div
                      key={p.key}
                      style={{
                        padding: '12px',
                        borderRadius: '10px',
                        border: `1px solid ${isOff ? '#fca5a5' : '#bbf7d0'}`,
                        background: isOff ? '#fff1f2' : '#f0fdf4',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.92rem', color: isOff ? '#991b1b' : '#166534' }}>
                          {p.label}
                        </span>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '999px',
                            background: isOff ? '#fee2e2' : '#dcfce7',
                            color: isOff ? '#b91c1c' : '#15803d',
                          }}
                        >
                          {isOff ? 'Desactivado' : 'Activo'}
                        </span>
                      </div>
                      <small style={{ color: '#64748b' }}>{countTemas} {countTemas === 1 ? 'tema' : 'temas'}</small>
                      <button
                        type="button"
                        onClick={() => toggleParcial(p.key)}
                        style={{
                          marginTop: '4px',
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border: 'none',
                          background: isOff ? '#16a34a' : '#dc2626',
                          color: '#ffffff',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                        }}
                      >
                        {isOff ? 'Activar Parcial' : 'Desactivar Parcial'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Control de Temas Individuales */}
            <div style={{ marginTop: '14px', borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#0f172a', fontWeight: 700 }}>
                    Temas individuales
                  </h4>
                  <small style={{ color: '#64748b' }}>Activa o desactiva temas específicos por separado</small>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    placeholder="Filtrar temas por nombre..."
                    value={searchTema}
                    onChange={(e) => setSearchTema(e.target.value)}
                    style={{
                      padding: '5px 10px',
                      fontSize: '0.82rem',
                      border: '1px solid #cbd5e1',
                      borderRadius: '6px',
                      minWidth: '180px',
                    }}
                  />
                </div>
              </div>

              {/* Pestañas de parcial */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', flexWrap: 'wrap' }}>
                {PARCIALES_LIST.map((p) => {
                  const isActive = activeParcialTab === p.key;
                  const isParentOff = isParcialOff(p.key);
                  const temasInParcial = temas.filter((t) => t.parcial === p.key);
                  const disabledCount = temasInParcial.filter((t) => isTemaOff(t.id)).length;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setActiveParcialTab(p.key)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: 'none',
                        background: isActive ? '#0369a1' : '#f1f5f9',
                        color: isActive ? '#ffffff' : '#334155',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                      }}
                    >
                      {p.label} ({temasInParcial.length})
                      {disabledCount > 0 && (
                        <span style={{ marginLeft: '6px', background: isActive ? 'rgba(255,255,255,0.3)' : '#fee2e2', color: isActive ? '#fff' : '#b91c1c', padding: '1px 5px', borderRadius: '4px', fontSize: '0.72rem' }}>
                          {disabledCount} off
                        </span>
                      )}
                      {isParentOff && (
                        <span style={{ marginLeft: '4px', fontSize: '0.7rem', color: isActive ? '#fef08a' : '#dc2626' }}>
                          (Parcial Off)
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Acciones en lote para el parcial activo */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                  Mostrando {filteredTemas.length} temas de este parcial
                </span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setAllTemasInParcial(activeParcialTab, true)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Activar todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setAllTemasInParcial(activeParcialTab, false)}
                    style={{ padding: '3px 8px', fontSize: '0.75rem', borderRadius: '4px', border: '1px solid #fecaca', background: '#fff1f2', color: '#991b1b', cursor: 'pointer', fontWeight: 600 }}
                  >
                    Desactivar todos
                  </button>
                </div>
              </div>

              {/* Lista de temas */}
              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingRight: '4px' }}>
                {loadingTemas ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem' }}>Cargando temas...</p>
                ) : filteredTemas.length === 0 ? (
                  <p style={{ color: '#64748b', fontSize: '0.85rem' }}>No se encontraron temas con ese criterio.</p>
                ) : (
                  filteredTemas.map((tema) => {
                    const isParentOff = isParcialOff(tema.parcial);
                    const isOff = isTemaOff(tema.id);
                    const effectivelyDisabled = isParentOff || isOff;
                    return (
                      <div
                        key={tema.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '7px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${effectivelyDisabled ? '#fecaca' : '#e2e8f0'}`,
                          background: effectivelyDisabled ? '#fff5f5' : '#ffffff',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="checkbox"
                            id={`tema-ctrl-${tema.id}`}
                            checked={!isOff && !isParentOff}
                            disabled={isParentOff}
                            onChange={() => toggleTema(tema.id)}
                            style={{ cursor: isParentOff ? 'not-allowed' : 'pointer' }}
                          />
                          <label
                            htmlFor={`tema-ctrl-${tema.id}`}
                            style={{
                              fontSize: '0.86rem',
                              fontWeight: 600,
                              color: effectivelyDisabled ? '#991b1b' : '#0f172a',
                              cursor: isParentOff ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {tema.nombre}
                          </label>
                          {isParentOff && (
                            <span style={{ fontSize: '0.72rem', color: '#b91c1c', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px' }}>
                              Parcial desactivado
                            </span>
                          )}
                        </div>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: effectivelyDisabled ? '#dc2626' : '#16a34a',
                          }}
                        >
                          {effectivelyDisabled ? 'Oculto' : 'Visible'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div style={{ marginTop: '14px', display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button className="control-primary" disabled={saving} onClick={saveControls}>
                {saving ? 'Guardando controles…' : 'Aplicar controles parciales'}
              </button>
            </div>
          </div>
        </details>

        <details className="control-section">
          <summary><Activity size={20} /><span><b>Diagnóstico y presencia</b><small>Comprueba servicios y limpia conexiones vencidas</small></span></summary>
          <div className="control-section-body">
            <div className="control-actions"><button onClick={() => void runSiteDiagnostics().then(setDiagnostics)}>Ejecutar diagnóstico</button><button onClick={() => void cleanStalePresence().then((r) => setMessage(r.ok ? `${r.removed} presencias vencidas eliminadas.` : String(r.error)))}>Limpiar usuarios inactivos</button></div>
            {diagnostics.map((item) => <div className={`diagnostic-row ${item.ok ? 'ok' : 'bad'}`} key={item.name}><b>{item.name}</b><span>{item.detail} · {item.durationMs} ms</span></div>)}
          </div>
        </details>

        <details className="control-section">
          <summary><ShieldCheck size={20} /><span><b>Sesiones y seguridad</b><small>Revisa accesos activos y cierra sesiones sospechosas</small></span></summary>
          <div className="control-section-body">
            <button onClick={() => void refreshSecurity()}>Actualizar sesiones</button>
            {sessions.length === 0 ? <p className="control-empty">No hay sesiones para mostrar.</p> : sessions.map((session) => <div className="session-row" key={session.id}><span><b>{session.username}</b><small>Última actividad: {new Date(session.last_seen_at).toLocaleString()}</small></span>{session.current ? <em>Esta sesión</em> : <button onClick={() => void revokeAdminSession(session.id).then(refreshSecurity)}>Cerrar</button>}</div>)}
          </div>
        </details>

        <details className="control-section">
          <summary><DatabaseBackup size={20} /><span><b>Respaldo de información</b><small>Exporta una copia JSON de los datos principales</small></span></summary>
          <div className="control-section-body"><p>La exportación no modifica ni elimina información.</p><button className="control-primary" onClick={() => void downloadSiteBackup()}>Descargar respaldo completo</button></div>
        </details>

        <details className="control-section">
          <summary><HardDrive size={20} /><span><b>Estado del almacenamiento</b><small>Referencias duplicadas y registros sin imagen</small></span></summary>
          <div className="control-section-body"><button onClick={() => void getStorageInventory().then(setInventory)}>Analizar referencias</button>{inventory && <div className="inventory-grid"><span><b>{inventory.referencedImages}</b> referencias</span><span><b>{inventory.uniqueImages}</b> únicas</span><span><b>{inventory.duplicateReferences}</b> duplicadas</span><span><b>{inventory.missingPlateUrls}</b> placas sin URL</span></div>}</div>
        </details>

        <details className="control-section control-section-wide">
          <summary><History size={20} /><span><b>Errores y auditoría</b><small>Historial de acciones del centro de control y fallos recientes</small></span></summary>
          <div className="control-section-body"><button onClick={() => void refreshSecurity()}>Actualizar historial</button><h3>Errores recientes</h3>{errors.length === 0 ? <p className="control-empty">No se registran errores recientes.</p> : errors.map((entry) => <AuditRow key={`e-${entry.id}`} entry={entry} />)}<h3>Acciones administrativas</h3>{audit.length === 0 ? <p className="control-empty">No hay acciones registradas.</p> : audit.map((entry) => <AuditRow key={`a-${entry.id}`} entry={entry} />)}</div>
        </details>
      </div>
    </section>
  );
};

const AuditRow = ({ entry }: { entry: AuditEntry }) => <div className="control-audit-row"><span><b>{entry.event_type}</b><small>{entry.username || 'Sistema'}</small></span><time>{new Date(entry.created_at).toLocaleString()}</time></div>;

export default SiteControlCenter;
