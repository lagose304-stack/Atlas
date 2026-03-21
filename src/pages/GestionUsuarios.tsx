import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import BackButton from '../components/BackButton';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

type Rol = 'Instructor' | 'Microscopía' | 'Administrador';

interface Usuario {
  id: number;
  username: string;
  nombre: string;
  rol: Rol;
  activo?: boolean;
  session_version?: number;
  is_protected?: boolean;
}

type Panel = 'crear' | 'editar' | 'borrar' | null;

const ROLES: Rol[] = ['Instructor', 'Microscopía', 'Administrador'];

// ---------- helpers de color por panel ----------
const panelColor: Record<NonNullable<Panel>, string> = {
  crear:  'linear-gradient(135deg, #10b981, #34d399)',
  editar: 'linear-gradient(135deg, #3b82f6, #60a5fa)',
  borrar: 'linear-gradient(135deg, #ef4444, #f87171)',
};

const GestionUsuarios: React.FC = () => {
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [toast, setToast]   = useState<{ msg: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [supportsSecurityColumns, setSupportsSecurityColumns] = useState<boolean | null>(null);
  const [supportsProtectedColumn, setSupportsProtectedColumn] = useState<boolean | null>(null);

  // ---- Crear ----
  const [crearForm, setCrearForm] = useState({ username: '', password: '', nombre: '', rol: '' as Rol | '' });
  const [showCrearPassword, setShowCrearPassword] = useState(false);

  // ---- Editar ----
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [busquedaEditar, setBusquedaEditar] = useState('');
  const [usuarioEditar, setUsuarioEditar] = useState<Usuario | null>(null);
  const [editarForm, setEditarForm] = useState({ username: '', password: '', nombre: '', rol: '' as Rol | '' });
  const [showEditarPassword, setShowEditarPassword] = useState(false);

  // ---- Borrar ----
  const [busquedaBorrar, setBusquedaBorrar] = useState('');
  const [usuarioBorrar, setUsuarioBorrar] = useState<Usuario | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const detectSecurityColumns = async (): Promise<boolean> => {
    const { error } = await supabase
      .from('usuarios')
      .select('id, activo, session_version')
      .limit(1);

    const supported = !error;
    setSupportsSecurityColumns(supported);
    return supported;
  };

  const detectProtectedColumn = async (): Promise<boolean> => {
    const { error } = await supabase
      .from('usuarios')
      .select('id, is_protected')
      .limit(1);

    const supported = !error;
    setSupportsProtectedColumn(supported);
    return supported;
  };

  const loadUsuarios = async () => {
    let supportsColumns = supportsSecurityColumns;
    if (supportsColumns === null) {
      supportsColumns = await detectSecurityColumns();
    }

    let supportsProtected = supportsProtectedColumn;
    if (supportsProtected === null) {
      supportsProtected = await detectProtectedColumn();
    }

    if (supportsColumns) {
      const query = supportsProtected
        ? supabase
            .from('usuarios')
            .select('id, username, nombre, rol, activo, session_version, is_protected')
            .eq('activo', true)
            .order('nombre')
        : supabase
            .from('usuarios')
            .select('id, username, nombre, rol, activo, session_version')
            .eq('activo', true)
            .order('nombre');

      const { data } = await query;
      if (data) {
        setUsuarios((data as Usuario[]).map((u) => ({
          ...u,
          is_protected: u.is_protected ?? false,
        })));
      }
      return;
    }

    const fallbackQuery = supportsProtected
      ? supabase
          .from('usuarios')
          .select('id, username, nombre, rol, is_protected')
          .order('nombre')
      : supabase
          .from('usuarios')
          .select('id, username, nombre, rol')
          .order('nombre');

    const { data } = await fallbackQuery;
    if (data) {
      setUsuarios((data as Usuario[]).map((u) => ({
        ...u,
        activo: true,
        session_version: 1,
        is_protected: u.is_protected ?? false,
      })));
    }
  };

  useEffect(() => {
    void detectSecurityColumns();
    void detectProtectedColumn();
  }, []);

  useEffect(() => {
    if (activePanel === 'editar' || activePanel === 'borrar') loadUsuarios();
  }, [activePanel, supportsSecurityColumns, supportsProtectedColumn]);

  const togglePanel = (p: Panel) => setActivePanel(prev => (prev === p ? null : p));

  const isProtectedUser = (u: Usuario): boolean => {
    return u.is_protected === true;
  };

  // ======================================================
  // CREAR
  // ======================================================
  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crearForm.rol) { showToast('Selecciona un rol.', false); return; }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(crearForm.username)) { showToast('El username debe ser un correo válido.', false); return; }
    if (crearForm.password.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres.', false); return; }

    setLoading(true);
    const payload = {
      username: crearForm.username.trim().toLowerCase(),
      password: crearForm.password,
      nombre: crearForm.nombre.trim(),
      rol: crearForm.rol,
      ...(supportsSecurityColumns ? { activo: true, session_version: 1 } : {}),
      ...(supportsProtectedColumn ? { is_protected: false } : {}),
    };

    const { error } = await supabase.from('usuarios').insert(payload);
    setLoading(false);

    if (error) {
      showToast(error.code === '23505' ? 'Ya existe un usuario con ese correo.' : 'Error al crear usuario.', false);
    } else {
      showToast('Usuario creado correctamente.');
      setCrearForm({ username: '', password: '', nombre: '', rol: '' });
      setShowCrearPassword(false);
    }
  };

  // ======================================================
  // EDITAR
  // ======================================================
  const seleccionarParaEditar = (u: Usuario) => {
    if (isProtectedUser(u)) {
      showToast('Este usuario esta protegido y no puede editarse desde este panel.', false);
      return;
    }
    setUsuarioEditar(u);
    setEditarForm({ username: u.username, password: '', nombre: u.nombre, rol: u.rol });
    setShowEditarPassword(false);
  };

  const handleEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuarioEditar) return;
    if (!editarForm.rol) { showToast('Selecciona un rol.', false); return; }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(editarForm.username)) { showToast('El username debe ser un correo válido.', false); return; }

    const payload: Record<string, string> = {
      username: editarForm.username.trim().toLowerCase(),
      nombre: editarForm.nombre.trim(),
      rol: editarForm.rol,
    };
    if (editarForm.password.trim()) {
      if (editarForm.password.length < 6) { showToast('La contraseña debe tener al menos 6 caracteres.', false); return; }
      payload.password = editarForm.password;
    }

    setLoading(true);
    const updatePayload: Record<string, string | number> = {
      ...payload,
      ...(supportsSecurityColumns ? { session_version: (usuarioEditar.session_version ?? 1) + 1 } : {}),
    };

    const { error } = await supabase.from('usuarios').update(updatePayload).eq('id', usuarioEditar.id);
    setLoading(false);

    if (error) {
      showToast('Error al actualizar usuario.', false);
    } else {
      showToast('Usuario actualizado correctamente.');
      setUsuarioEditar(null);
      setEditarForm({ username: '', password: '', nombre: '', rol: '' });
      setShowEditarPassword(false);
      setBusquedaEditar('');
      loadUsuarios();
    }
  };

  // ======================================================
  // BORRAR
  // ======================================================
  const handleBorrar = async () => {
    if (!usuarioBorrar) return;
    if (isProtectedUser(usuarioBorrar)) {
      showToast('Este usuario esta protegido y no puede desactivarse.', false);
      return;
    }
    if (!window.confirm(`¿Desactivar al usuario "${usuarioBorrar.nombre}" (${usuarioBorrar.username})?`)) return;

    setLoading(true);

    let error: { code?: string } | null = null;
    if (supportsSecurityColumns) {
      const result = await supabase
        .from('usuarios')
        .update({ activo: false, session_version: (usuarioBorrar.session_version ?? 1) + 1 })
        .eq('id', usuarioBorrar.id);
      error = result.error;
    } else {
      const result = await supabase.from('usuarios').delete().eq('id', usuarioBorrar.id);
      error = result.error;
    }

    setLoading(false);

    if (error) {
      showToast('Error al desactivar usuario.', false);
    } else {
      showToast(
        supportsSecurityColumns
          ? 'Usuario desactivado y sesiones revocadas correctamente.'
          : 'Usuario eliminado correctamente.',
      );
      setUsuarioBorrar(null);
      setBusquedaBorrar('');
      loadUsuarios();
    }
  };

  // ======================================================
  // Filtros de búsqueda
  // ======================================================
  const usuariosFiltradosEditar = usuarios.filter(u =>
    u.username.toLowerCase().includes(busquedaEditar.toLowerCase()) ||
    u.nombre.toLowerCase().includes(busquedaEditar.toLowerCase())
  );

  const usuariosFiltradosBorrar = usuarios.filter(u =>
    u.username.toLowerCase().includes(busquedaBorrar.toLowerCase()) ||
    u.nombre.toLowerCase().includes(busquedaBorrar.toLowerCase())
  );
  const handleGoBack = useSmartBackNavigation('/edicion');

  return (
    <div style={s.page}>
      <Header />

      <main style={s.main}>
                <BackButton onClick={handleGoBack} />

        {/* Encabezado */}
        <div style={s.pageHeader}>
          <h1 style={s.pageTitle}>Gestión de usuarios</h1>
          <p style={s.pageSubtitle}>Crea, edita o desactiva usuarios del sistema.</p>
          <div style={s.accentLine} />
        </div>

        {/* ---- Paneles acordeón ---- */}
        <div style={s.panelsWrap}>

          {/* === CREAR === */}
          <div style={s.panel}>
            <button
              style={{ ...s.panelHeader, ...(activePanel === 'crear' ? s.panelHeaderActive : {}) }}
              onClick={() => togglePanel('crear')}
            >
              <span style={{ ...s.panelDot, background: panelColor.crear }} />
              <span style={s.panelLabel}>➕ Crear usuario</span>
              <span style={s.chevron}>{activePanel === 'crear' ? '▲' : '▼'}</span>
            </button>

            {activePanel === 'crear' && (
              <form style={s.panelBody} onSubmit={handleCrear}>
                <div style={s.formGrid}>
                  <label style={s.label}>
                    Correo electrónico (username)
                    <input
                      type="email"
                      style={s.input}
                      placeholder="usuario@correo.com"
                      value={crearForm.username}
                      onChange={e => setCrearForm(p => ({ ...p, username: e.target.value }))}
                      required
                    />
                  </label>

                  <label style={s.label}>
                    Nombre completo
                    <input
                      type="text"
                      style={s.input}
                      placeholder="Ej. Juan Pérez"
                      value={crearForm.nombre}
                      onChange={e => setCrearForm(p => ({ ...p, nombre: e.target.value }))}
                      required
                    />
                  </label>

                  <label style={s.label}>
                    Contraseña
                    <div style={s.passwordWrap}>
                      <input
                        type={showCrearPassword ? 'text' : 'password'}
                        style={{ ...s.input, ...s.passwordInput }}
                        placeholder="Mínimo 6 caracteres"
                        value={crearForm.password}
                        onChange={e => setCrearForm(p => ({ ...p, password: e.target.value }))}
                        required
                      />
                      <button
                        type="button"
                        style={s.passwordToggleBtn}
                        onClick={() => setShowCrearPassword(prev => !prev)}
                        aria-label={showCrearPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        title={showCrearPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      >
                        {showCrearPassword ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </label>

                  <div style={s.label}>
                    Rol
                    <div style={s.roleGroup}>
                      {ROLES.map(r => (
                        <button
                          key={r}
                          type="button"
                          style={{
                            ...s.roleChip,
                            ...(crearForm.rol === r ? s.roleChipActive : {}),
                          }}
                          onClick={() => setCrearForm(p => ({ ...p, rol: r }))}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button type="submit" style={s.submitBtn} disabled={loading}>
                  {loading ? 'Creando...' : '✔ Crear usuario'}
                </button>
              </form>
            )}
          </div>

          {/* === EDITAR === */}
          <div style={s.panel}>
            <button
              style={{ ...s.panelHeader, ...(activePanel === 'editar' ? s.panelHeaderActive : {}) }}
              onClick={() => togglePanel('editar')}
            >
              <span style={{ ...s.panelDot, background: panelColor.editar }} />
              <span style={s.panelLabel}>✏️ Editar usuario</span>
              <span style={s.chevron}>{activePanel === 'editar' ? '▲' : '▼'}</span>
            </button>

            {activePanel === 'editar' && (
              <div style={s.panelBody}>
                {!usuarioEditar ? (
                  <>
                    <label style={s.label}>
                      Buscar usuario
                      <input
                        type="text"
                        style={s.input}
                        placeholder="Nombre o correo..."
                        value={busquedaEditar}
                        onChange={e => setBusquedaEditar(e.target.value)}
                      />
                    </label>
                    <div style={s.userList}>
                      {usuariosFiltradosEditar.length === 0 && (
                        <p style={s.emptyMsg}>No se encontraron usuarios.</p>
                      )}
                      {usuariosFiltradosEditar.map(u => (
                        <button
                          key={u.id}
                          style={s.userRow}
                          onClick={() => seleccionarParaEditar(u)}
                          title={isProtectedUser(u) ? 'Usuario protegido: no editable' : 'Seleccionar usuario para editar'}
                        >
                          <span style={s.userAvatar}>{u.nombre.charAt(0).toUpperCase()}</span>
                          <span style={s.userInfo}>
                            <strong>{u.nombre}</strong>
                            <small>{u.username}</small>
                          </span>
                          <span style={{ ...s.rolBadge, ...getRolStyle(u.rol) }}>{u.rol}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleEditar}>
                    <div style={{ ...s.selectedBanner, borderColor: '#60a5fa' }}>
                      <span>✏️ Editando: <strong>{usuarioEditar.nombre}</strong></span>
                      <button type="button" style={s.cancelBtn} onClick={() => setUsuarioEditar(null)}>
                        Cancelar
                      </button>
                    </div>

                    <div style={s.formGrid}>
                      <label style={s.label}>
                        Correo electrónico (username)
                        <input
                          type="email"
                          style={s.input}
                          value={editarForm.username}
                          onChange={e => setEditarForm(p => ({ ...p, username: e.target.value }))}
                          required
                        />
                      </label>

                      <label style={s.label}>
                        Nombre completo
                        <input
                          type="text"
                          style={s.input}
                          value={editarForm.nombre}
                          onChange={e => setEditarForm(p => ({ ...p, nombre: e.target.value }))}
                          required
                        />
                      </label>

                      <label style={s.label}>
                        Nueva contraseña <small style={{ color: '#94a3b8' }}>(dejar en blanco para no cambiar)</small>
                        <div style={s.passwordWrap}>
                          <input
                            type={showEditarPassword ? 'text' : 'password'}
                            style={{ ...s.input, ...s.passwordInput }}
                            placeholder="Nueva contraseña"
                            value={editarForm.password}
                            onChange={e => setEditarForm(p => ({ ...p, password: e.target.value }))}
                          />
                          <button
                            type="button"
                            style={s.passwordToggleBtn}
                            onClick={() => setShowEditarPassword(prev => !prev)}
                            aria-label={showEditarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            title={showEditarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                          >
                            {showEditarPassword ? 'Ocultar' : 'Mostrar'}
                          </button>
                        </div>
                      </label>

                      <div style={s.label}>
                        Rol
                        <div style={s.roleGroup}>
                          {ROLES.map(r => (
                            <button
                              key={r}
                              type="button"
                              style={{
                                ...s.roleChip,
                                ...(editarForm.rol === r ? s.roleChipActive : {}),
                              }}
                              onClick={() => setEditarForm(p => ({ ...p, rol: r }))}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button type="submit" style={{ ...s.submitBtn, background: 'linear-gradient(135deg,#3b82f6,#60a5fa)' }} disabled={loading}>
                      {loading ? 'Guardando...' : '✔ Guardar cambios'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* === BORRAR === */}
          <div style={s.panel}>
            <button
              style={{ ...s.panelHeader, ...(activePanel === 'borrar' ? s.panelHeaderActive : {}) }}
              onClick={() => togglePanel('borrar')}
            >
              <span style={{ ...s.panelDot, background: panelColor.borrar }} />
              <span style={s.panelLabel}>🚫 Desactivar usuario</span>
              <span style={s.chevron}>{activePanel === 'borrar' ? '▲' : '▼'}</span>
            </button>

            {activePanel === 'borrar' && (
              <div style={s.panelBody}>
                {!usuarioBorrar ? (
                  <>
                    <label style={s.label}>
                      Buscar usuario
                      <input
                        type="text"
                        style={s.input}
                        placeholder="Nombre o correo..."
                        value={busquedaBorrar}
                        onChange={e => setBusquedaBorrar(e.target.value)}
                      />
                    </label>
                    <div style={s.userList}>
                      {usuariosFiltradosBorrar.length === 0 && (
                        <p style={s.emptyMsg}>No se encontraron usuarios.</p>
                      )}
                      {usuariosFiltradosBorrar.map(u => (
                        <button
                          key={u.id}
                          style={{ ...s.userRow, ...s.userRowDanger }}
                          onClick={() => {
                            if (isProtectedUser(u)) {
                              showToast('Este usuario esta protegido y no puede desactivarse.', false);
                              return;
                            }
                            setUsuarioBorrar(u);
                          }}
                          title={isProtectedUser(u) ? 'Usuario protegido: no desactivable' : 'Seleccionar usuario para desactivar'}
                        >
                          <span style={{ ...s.userAvatar, background: '#fee2e2', color: '#ef4444' }}>{u.nombre.charAt(0).toUpperCase()}</span>
                          <span style={s.userInfo}>
                            <strong>{u.nombre}</strong>
                            <small>{u.username}</small>
                          </span>
                          <span style={{ ...s.rolBadge, ...getRolStyle(u.rol) }}>{u.rol}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div>
                    <div style={{ ...s.selectedBanner, borderColor: '#f87171', background: '#fff5f5' }}>
                      <span>🚫 Desactivar: <strong>{usuarioBorrar.nombre}</strong> ({usuarioBorrar.username})</span>
                      <button type="button" style={s.cancelBtn} onClick={() => setUsuarioBorrar(null)}>
                        Cancelar
                      </button>
                    </div>
                    <p style={{ color: '#ef4444', margin: '12px 0', fontSize: '0.92em' }}>
                      {supportsSecurityColumns
                        ? 'El usuario perdera el acceso inmediatamente y cualquier sesion abierta sera invalidada.'
                        : 'Esta accion no se puede deshacer. El usuario perdera el acceso al sistema.'}
                    </p>
                    <button
                      style={{ ...s.submitBtn, background: 'linear-gradient(135deg,#ef4444,#f87171)' }}
                      onClick={handleBorrar}
                      disabled={loading}
                    >
                      {loading ? 'Procesando...' : supportsSecurityColumns ? '🚫 Confirmar desactivacion' : '🗑️ Confirmar eliminacion'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div style={{ ...s.toast, background: toast.ok ? '#059669' : '#dc2626' }}>
          {toast.ok ? '✔ ' : '✖ '}{toast.msg}
        </div>
      )}

      <Footer />
    </div>
  );
};

// Color de badge según rol
function getRolStyle(rol: Rol): React.CSSProperties {
  if (rol === 'Administrador') return { background: '#ede9fe', color: '#7c3aed', border: '1px solid #c4b5fd' };
  if (rol === 'Microscopía')   return { background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0' };
  return { background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' };
}

const s: { [key: string]: React.CSSProperties } = {
  page: {
    minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: "'Inter', 'Segoe UI', sans-serif", color: '#0f172a', backgroundColor: 'transparent',
  },
  main: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'clamp(16px, 3vw, 28px)',
    padding: 'clamp(16px, 4vw, 40px) clamp(12px, 3vw, 24px) clamp(24px, 5vw, 56px)',
    width: '100%',
    maxWidth: '780px',
    boxSizing: 'border-box',
  },

  // Breadcrumb
  breadcrumb: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    flexWrap: 'wrap',
    background: 'rgba(255,255,255,0.75)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(186,230,253,0.6)',
    borderRadius: '12px',
    padding: '8px 16px',
    boxShadow: '0 2px 8px rgba(14,165,233,0.07)',
    alignSelf: 'flex-start',
  },
  breadBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#0ea5e9',
    fontWeight: 600,
    fontSize: '0.88em',
    padding: '4px 8px',
    borderRadius: '8px',
    fontFamily: 'inherit',
  },
  sep: { color: '#94a3b8', fontWeight: 700, fontSize: '0.75em' },
  breadCurrent: {
    color: '#0f172a',
    fontWeight: 800,
    fontSize: '0.88em',
    padding: '4px 8px',
    background: 'linear-gradient(135deg, #e0f2fe, #ede9fe)',
    borderRadius: '8px',
    border: '1px solid #bae6fd',
  },

  // Encabezado
  pageHeader: { width: '100%', display: 'flex', flexDirection: 'column', gap: '6px' },
  pageTitle: { fontSize: 'clamp(1.6em, 4vw, 2.2em)', fontWeight: 900, color: '#0f172a', margin: 0 },
  pageSubtitle: { fontSize: '0.92em', color: '#64748b', margin: 0 },
  accentLine: { marginTop: '10px', width: '56px', height: '4px', background: 'linear-gradient(90deg, #38bdf8, #818cf8)', borderRadius: '4px' },

  // Paneles
  panelsWrap: { width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' },
  panel: {
    background: '#fff',
    borderRadius: '16px',
    boxShadow: '0 4px 16px rgba(15,23,42,0.07), 0 1px 4px rgba(15,23,42,0.04)',
    border: '1px solid rgba(15,23,42,0.06)',
    overflow: 'hidden',
  },
  panelHeader: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '16px 20px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '1em',
    fontWeight: 700,
    color: '#0f172a',
    textAlign: 'left',
    transition: 'background 0.15s',
  } as React.CSSProperties,
  panelHeaderActive: { background: '#f8fafc' },
  panelDot: { width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0 },
  panelLabel: { flex: 1 },
  chevron: { color: '#94a3b8', fontSize: '0.8em' },
  panelBody: { padding: '0 20px 22px', display: 'flex', flexDirection: 'column', gap: '14px' },

  // Formulario
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' } as React.CSSProperties,
  label: { display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.88em', fontWeight: 600, color: '#374151' } as React.CSSProperties,
  input: {
    padding: '9px 12px',
    borderRadius: '8px',
    border: '1.5px solid #e2e8f0',
    fontSize: '0.9em',
    fontFamily: 'inherit',
    color: '#0f172a',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  passwordWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  passwordInput: {
    flex: 1,
  },
  passwordToggleBtn: {
    border: '1.5px solid #cbd5e1',
    background: '#f8fafc',
    color: '#334155',
    borderRadius: '8px',
    padding: '8px 11px',
    fontSize: '0.8em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },
  roleGroup: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '2px' },
  roleChip: {
    padding: '7px 14px',
    borderRadius: '8px',
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    color: '#475569',
    fontSize: '0.85em',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  } as React.CSSProperties,
  roleChipActive: {
    background: 'linear-gradient(135deg, #6366f1, #818cf8)',
    color: '#fff',
    borderColor: 'transparent',
  },
  submitBtn: {
    alignSelf: 'flex-start',
    padding: '10px 22px',
    borderRadius: '10px',
    border: 'none',
    background: 'linear-gradient(135deg, #10b981, #34d399)',
    color: '#fff',
    fontSize: '0.9em',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: '4px',
  } as React.CSSProperties,

  // Lista de usuarios
  userList: { display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto' } as React.CSSProperties,
  userRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    borderRadius: '10px',
    border: '1.5px solid #e2e8f0',
    background: '#f8fafc',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
    transition: 'border-color 0.15s, background 0.15s',
  } as React.CSSProperties,
  userRowDanger: { borderColor: '#fee2e2', background: '#fff5f5' },
  userAvatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    background: '#ede9fe',
    color: '#6366f1',
    fontWeight: 800,
    fontSize: '0.95em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  } as React.CSSProperties,
  userInfo: { display: 'flex', flexDirection: 'column', gap: '1px', flex: 1, fontSize: '0.88em' } as React.CSSProperties,
  rolBadge: {
    padding: '3px 9px',
    borderRadius: '6px',
    fontSize: '0.78em',
    fontWeight: 700,
    flexShrink: 0,
  },
  emptyMsg: { color: '#94a3b8', fontSize: '0.88em', margin: 0 },

  // Banner de seleccionado
  selectedBanner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 14px',
    borderRadius: '8px',
    background: '#f0f9ff',
    border: '1.5px solid #bae6fd',
    fontSize: '0.88em',
    marginBottom: '8px',
  } as React.CSSProperties,
  cancelBtn: {
    background: 'none',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    padding: '4px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: '0.85em',
    color: '#64748b',
  },

  // Toast
  toast: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '12px 24px',
    borderRadius: '12px',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9em',
    boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
    zIndex: 9999,
    whiteSpace: 'nowrap',
  } as React.CSSProperties,
};

export default GestionUsuarios;






