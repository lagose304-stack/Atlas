import React, { useEffect, useState } from 'react';
import { Activity, Bell, DatabaseBackup, HardDrive, History, ShieldCheck, SlidersHorizontal } from 'lucide-react';
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

const SiteControlCenter: React.FC = () => {
  const [controls, setControls] = useState<SiteControls>(DEFAULT_CONTROLS);
  const [saving, setSaving] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [errors, setErrors] = useState<AuditEntry[]>([]);
  const [inventory, setInventory] = useState<Awaited<ReturnType<typeof getStorageInventory>> | null>(null);
  const [message, setMessage] = useState('');

  const refreshSecurity = async () => {
    const [nextSessions, nextAudit, nextErrors] = await Promise.all([fetchAdminSessions(), fetchControlAudit(), fetchRecentClientErrors()]);
    setSessions(nextSessions); setAudit(nextAudit); setErrors(nextErrors);
  };

  useEffect(() => { void fetchSiteControls().then(setControls); void refreshSecurity(); }, []);

  const saveControls = async () => {
    setSaving(true); const result = await saveSiteControls(controls); setSaving(false);
    setMessage(result.ok ? 'Configuración guardada correctamente.' : `No se pudo guardar: ${result.error}`);
    if (result.ok) void refreshSecurity();
  };

  const toggleFeature = (key: string) => setControls((current) => ({
    ...current,
    disabledFeatures: current.disabledFeatures.includes(key)
      ? current.disabledFeatures.filter((item) => item !== key)
      : [...current.disabledFeatures, key],
  }));

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

        <details className="control-section">
          <summary><SlidersHorizontal size={20} /><span><b>Controles parciales</b><small>Desactiva funciones sin apagar todo el sitio</small></span></summary>
          <div className="control-section-body">
            {FEATURES.map((feature) => <label className="control-check" key={feature.key}><input type="checkbox" checked={!controls.disabledFeatures.includes(feature.key)} onChange={() => toggleFeature(feature.key)} /> {feature.label}</label>)}
            <button className="control-primary" disabled={saving} onClick={saveControls}>Aplicar controles</button>
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
