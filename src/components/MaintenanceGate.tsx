import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchSiteMaintenanceStatus, type SiteMaintenanceStatus } from '../services/siteMaintenance';
import LoginForm from './LoginForm';

const MaintenanceGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<SiteMaintenanceStatus | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    void fetchSiteMaintenanceStatus().then(setStatus);
  }, []);

  useEffect(() => {
    const searchDisabled = !isAuthenticated && status?.disabledFeatures.includes('search');
    document.body.classList.toggle('atlas-search-disabled', Boolean(searchDisabled));
    return () => document.body.classList.remove('atlas-search-disabled');
  }, [isAuthenticated, status]);

  if (authLoading || status === null) {
    return <div className="site-maintenance-loading" role="status">Cargando sitio...</div>;
  }

  if (!status.enabled || isAuthenticated) {
    const disabled = !isAuthenticated && (
      (status.disabledFeatures.includes('evaluations') && location.pathname.startsWith('/evaluaciones'))
      || (status.disabledFeatures.includes('public_catalog') && ['/temario', '/subtemas/', '/ver-placas/'].some((path) => location.pathname === path || location.pathname.startsWith(path)))
    );
    if (disabled) return <main className="site-feature-disabled"><section><Wrench size={36}/><h1>Sección temporalmente no disponible</h1><p>Estamos realizando ajustes. Intenta nuevamente más tarde.</p><a href="/">Volver al inicio</a></section></main>;
    return <>{status.bannerEnabled && status.bannerMessage && !isAuthenticated && <div className="site-global-banner" role="status">{status.bannerMessage}</div>}{children}</>;
  }

  return (
    <main className="site-maintenance-page">
      <section className="site-maintenance-panel" role="status" aria-live="polite">
        <div className="site-maintenance-icon" aria-hidden="true"><Wrench size={42} /></div>
        <p className="site-maintenance-eyebrow">Mantenimiento</p>
        <h1>Sitio temporalmente fuera de servicio</h1>
        <p className="site-maintenance-message">{status.message}</p>
        <p className="site-maintenance-help">Vuelve a intentarlo más tarde.</p>
        <button type="button" className="site-maintenance-login" onClick={() => setShowLogin(true)}>
          Acceso administrativo
        </button>
      </section>
      {showLogin && <LoginForm onClose={() => setShowLogin(false)} />}
    </main>
  );
};

export default MaintenanceGate;
