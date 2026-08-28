import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  canBypassMaintenance,
  fetchSiteMaintenanceStatus,
  isFeatureDisabled,
  subscribeSiteMaintenanceStatus,
  type SiteMaintenanceStatus,
} from '../services/siteMaintenance';
import LoginForm from './LoginForm';
import AtlasLoadingScreen from './AtlasLoadingScreen';
import laboratoryLogo from '../assets/logos/laboratorio.png';

const MaintenanceGate: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const location = useLocation();
  const [status, setStatus] = useState<SiteMaintenanceStatus | null>(null);
  const [showLogin, setShowLogin] = useState(false);

  // Carga inicial y suscripción a cambios en tiempo real + sondeo
  useEffect(() => {
    void fetchSiteMaintenanceStatus().then(setStatus);
    const unsubscribe = subscribeSiteMaintenanceStatus((nextStatus) => {
      setStatus(nextStatus);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  // Re-validar estado al cambiar de ruta para evitar estados obsoletos
  useEffect(() => {
    void fetchSiteMaintenanceStatus().then(setStatus);
  }, [location.pathname]);

  const canBypass = canBypassMaintenance(user, isAuthenticated);

  useEffect(() => {
    const searchDisabled = !canBypass && isFeatureDisabled('search', status?.disabledFeatures);
    document.body.classList.toggle('atlas-search-disabled', Boolean(searchDisabled));
    return () => document.body.classList.remove('atlas-search-disabled');
  }, [canBypass, status]);

  if (authLoading || status === null) {
    return <AtlasLoadingScreen fullScreen label="Preparando el sitio…" />;
  }

  // Si el mantenimiento global no está activo o el usuario es Administrador / Microscopía
  if (!status.enabled || canBypass) {
    const isEvaluationsDisabled =
      !canBypass &&
      isFeatureDisabled('evaluations', status.disabledFeatures) &&
      (location.pathname.startsWith('/evaluaciones') || location.pathname.startsWith('/pruebas/ejecutar'));

    const isCatalogDisabled =
      !canBypass &&
      isFeatureDisabled('public_catalog', status.disabledFeatures) &&
      ['/temario', '/subtemas', '/ver-placas', '/herramientas/comparador'].some(
        (path) => location.pathname === path || location.pathname.startsWith(`${path}/`),
      );

    if (isEvaluationsDisabled || isCatalogDisabled) {
      return (
        <main className="site-feature-disabled">
          <section>
            <Wrench size={36} />
            <h1>Sección temporalmente no disponible</h1>
            <p>Estamos realizando ajustes de mantenimiento. Intenta nuevamente más tarde.</p>
            <a href="/">Volver al inicio</a>
          </section>
        </main>
      );
    }

    return (
      <>
        {status.bannerEnabled && status.bannerMessage && !canBypass && (
          <div className="site-global-banner" role="status">
            {status.bannerMessage}
          </div>
        )}
        {children}
      </>
    );
  }

  // Mantenimiento global activado: solo accesible para rol Administrador o Microscopía
  return (
    <main className="site-maintenance-page">
      <section className="site-maintenance-panel" role="status" aria-live="polite">
        <div className="site-maintenance-brand" aria-hidden="true">
          <span className="site-maintenance-logo-orbit" />
          <img src={laboratoryLogo} alt="" className="site-maintenance-logo" />
        </div>
        <p className="site-maintenance-eyebrow">Histolab UNAH</p>
        <h1>Sitio en mantenimiento</h1>
        <p className="site-maintenance-visible-message">
          {status.message || 'Estamos preparando mejoras para brindarte una mejor experiencia. Volveremos muy pronto.'}
        </p>
        <span className="site-maintenance-status">
          <i /> Modo de mantenimiento activado
        </span>
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
      {showLogin && <LoginForm onClose={() => setShowLogin(false)} isMaintenanceLogin={true} />}
    </main>
  );
};

export default MaintenanceGate;
