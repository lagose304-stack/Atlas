import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import { logSiteVisitOncePerSession } from './services/analytics';
import SeoManager from './components/SeoManager';
import MaintenanceGate from './components/MaintenanceGate';
import { logClientError } from './services/adminControlCenter';

const Home = lazy(() => import('./pages/Home'));
const Edicion = lazy(() => import('./pages/Edicion'));
const TemarioPublico = lazy(() => import('./pages/TemarioPublico'));
const Temario = lazy(() => import('./pages/Temario'));
const Placas = lazy(() => import('./pages/Placas'));
const Subtemas = lazy(() => import('./pages/Subtemas'));
const PlacasSubtema = lazy(() => import('./pages/PlacasSubtema'));
const EditarTemario = lazy(() => import('./pages/EditarTemario'));
const EditarSubtemas = lazy(() => import('./pages/EditarSubtemas'));
const EditarPlacas = lazy(() => import('./pages/EditarPlacas'));
const EditorPaginas = lazy(() => import('./pages/EditorPaginas'));
const EliminarPlacas = lazy(() => import('./pages/EliminarPlacas'));
const MoverPlaca = lazy(() => import('./pages/MoverPlaca'));
const ListaEspera = lazy(() => import('./pages/ListaEspera'));
const GestionTinciones = lazy(() => import('./pages/GestionTinciones'));
const MapasInteractivos = lazy(() => import('./pages/MapasInteractivos'));
const GestionUsuarios = lazy(() => import('./pages/GestionUsuarios'));
const Pruebas = lazy(() => import('./pages/Pruebas'));
const GestionPruebas = lazy(() => import('./pages/GestionPruebas'));
const EditorDePruebas = lazy(() => import('./pages/EditorDePruebas'));
const EjecutarPrueba = lazy(() => import('./pages/EjecutarPrueba'));
const Evaluaciones = lazy(() => import('./pages/Evaluaciones'));
const AccesoDenegado = lazy(() => import('./pages/AccesoDenegado'));
const Estadisticas = lazy(() => import('./pages/Estadisticas'));

const ROLE_ADMIN = 'Administrador' as const;
const ROLE_MICRO = 'Microscopía' as const;

const RouteLoadingFallback = () => (
  <div role="status" aria-live="polite" className="route-loading-fallback">
    <span className="route-loading-spinner" aria-hidden="true" />
    <span>Cargando sección...</span>
  </div>
);

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const SiteVisitTracker: React.FC = () => {
  useEffect(() => {
    void logSiteVisitOncePerSession();
  }, []);

  return null;
};

const SpellcheckEnabler: React.FC = () => {
  useEffect(() => {
    const applySpellcheck = () => {
      const selector = [
        'textarea',
        'input:not([type])',
        'input[type="text"]',
        'input[type="search"]',
        'input[type="url"]',
        'input[type="email"]',
        'input[type="tel"]',
        '[contenteditable="true"]',
        '[contenteditable=""]',
      ].join(', ');

      document.querySelectorAll<HTMLElement>(selector).forEach(el => {
        if (el.getAttribute('data-no-spellcheck') === 'true') return;
        el.setAttribute('spellcheck', 'true');
        if (!el.getAttribute('lang')) el.setAttribute('lang', 'es');
        el.setAttribute('autocorrect', 'on');
        el.setAttribute('autocapitalize', 'sentences');
      });
    };

    applySpellcheck();

    const observer = new MutationObserver(() => {
      applySpellcheck();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable', 'type'],
    });

    return () => observer.disconnect();
  }, []);

  return null;
};

const ClientErrorReporter: React.FC = () => {
  useEffect(() => {
    const onError = (event: ErrorEvent) => { void logClientError('javascript_error', { message: event.message, source: event.filename, line: event.lineno, path: window.location.pathname }); };
    const onRejection = (event: PromiseRejectionEvent) => { void logClientError('unhandled_rejection', { message: String(event.reason), path: window.location.pathname }); };
    window.addEventListener('error', onError); window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <MaintenanceGate>
        <SeoManager />
        <ScrollToTop />
        <SiteVisitTracker />
        <SpellcheckEnabler />
        <ClientErrorReporter />
        <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {/* Ruta pública */}
          <Route path="/" element={<Home />} />
          <Route path="/temario" element={<TemarioPublico />} />
          
          {/* Rutas protegidas */}
          <Route
            path="/edicion"
            element={
              <PrivateRoute>
                <Edicion />
              </PrivateRoute>
            }
          />
          <Route
            path="/temario-admin"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <Temario />
              </PrivateRoute>
            }
          />
          <Route
            path="/placas"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <Placas />
              </PrivateRoute>
            }
          />
          <Route
            path="/editar-temario"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <EditarTemario />
              </PrivateRoute>
            }
          />
          <Route
            path="/editar-subtemas"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <EditarSubtemas />
              </PrivateRoute>
            }
          />
          <Route
            path="/editar-placas"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <EditarPlacas />
              </PrivateRoute>
            }
          />
          <Route
            path="/editor-paginas"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <EditorPaginas />
              </PrivateRoute>
            }
          />
          <Route
            path="/eliminar-placas"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <EliminarPlacas />
              </PrivateRoute>
            }
          />
          <Route
            path="/mover-placa"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <MoverPlaca />
              </PrivateRoute>
            }
          />
          <Route
            path="/lista-espera"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <ListaEspera />
              </PrivateRoute>
            }
          />
          <Route
            path="/gestion-tinciones"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <GestionTinciones />
              </PrivateRoute>
            }
          />
          <Route
            path="/mapas-interactivos"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <MapasInteractivos />
              </PrivateRoute>
            }
          />
          <Route
            path="/gestion-usuarios"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN]}>
                <GestionUsuarios />
              </PrivateRoute>
            }
          />
          <Route
            path="/estadisticas"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN]}>
                <Estadisticas />
              </PrivateRoute>
            }
          />
          <Route
            path="/pruebas/crear"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <Pruebas />
              </PrivateRoute>
            }
          />
          <Route
            path="/pruebas"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <GestionPruebas />
              </PrivateRoute>
            }
          />
          <Route
            path="/pruebas/editor/:pruebaId"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <EditorDePruebas />
              </PrivateRoute>
            }
          />
          <Route
            path="/pruebas/ejecutar/:pruebaId"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <EjecutarPrueba />
              </PrivateRoute>
            }
          />
          <Route path="/evaluaciones" element={<Evaluaciones />} />
          <Route path="/evaluaciones/ejecutar/:pruebaId" element={<EjecutarPrueba />} />
          <Route
            path="/acceso-denegado"
            element={
              <PrivateRoute>
                <AccesoDenegado />
              </PrivateRoute>
            }
          />
          
          {/* Subtemas - ruta pública */}
          <Route path="/subtemas/:temaId" element={<Subtemas />} />

          {/* Placas de un subtema - ruta pública */}
          <Route path="/ver-placas/:subtemaId" element={<PlacasSubtema />} />

          {/* Ruta de fallback */}
          <Route path="*" element={<Home />} />
        </Routes>
        </Suspense>
        </MaintenanceGate>
      </Router>
    </AuthProvider>
  );
};

export default App;
