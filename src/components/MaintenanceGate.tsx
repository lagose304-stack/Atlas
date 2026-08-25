import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { fetchSiteMaintenanceStatus, type SiteMaintenanceStatus } from '../services/siteMaintenance';
import LoginForm from './LoginForm';
import AtlasLoadingScreen from './AtlasLoadingScreen';
import laboratoryLogo from '../assets/logos/laboratorio.png';

const MaintenanceGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
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
    return <AtlasLoadingScreen fullScreen label="Preparando el sitio…" />;
  }

  const isSuperAdmin = isAuthenticated && (user?.rol === 'Administrador' || Boolean(user?.is_protected));

  if (!status.enabled || isSuperAdmin) {
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
        <div className="site-maintenance-brand" aria-hidden="true">
          <span className="site-maintenance-logo-orbit" />
          <img src={laboratoryLogo} alt="" className="site-maintenance-logo" />
        </div>
        <p className="site-maintenance-eyebrow">Histolab UNAH</p>
        <h1>Sitio en mantenimiento</h1>
        <p className="site-maintenance-visible-message">Estamos preparando mejoras para brindarte una mejor experiencia. Volveremos muy pronto.</p>
        <span className="site-maintenance-status"><i /> Modo de mantenimiento activado</span>
        <button type="button" className="site-maintenance-login" onClick={() => setShowLogin(true)}>
          Acceso administrativo
        </button>

        <div className="site-maintenance-seo-copy" aria-hidden="true">
          <h2>Atlas de Histología de la UNAH</h2>
          <p>Recurso educativo del Laboratorio de Histología de la Facultad de Ciencias Médicas de la Universidad Nacional Autónoma de Honduras.</p>
          <h2>Estudio de histología y microscopía</h2>
          <p>Histolab reúne temarios, subtemas, evaluaciones y placas histológicas para apoyar el aprendizaje y la identificación de tejidos mediante microscopía.</p>
        </div>
      </section>
      {showLogin && <LoginForm onClose={() => setShowLogin(false)} />}
    </main>
  );
};

export default MaintenanceGate;
