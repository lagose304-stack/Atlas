import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Home from './pages/Home';
import Edicion from './pages/Edicion';
import TemarioPublico from './pages/TemarioPublico';
import Temario from './pages/Temario';
import Placas from './pages/Placas';
import Subtemas from './pages/Subtemas';
import PlacasSubtema from './pages/PlacasSubtema';
import EditarHome from './pages/EditarHome';
import EditarInicio from './pages/EditarInicio';
import EditarTemario from './pages/EditarTemario';
import EditarSubtemas from './pages/EditarSubtemas';
import EditarPlacas from './pages/EditarPlacas';
import EliminarPlacas from './pages/EliminarPlacas';
import MoverPlaca from './pages/MoverPlaca';
import ListaEspera from './pages/ListaEspera';
import GestionUsuarios from './pages/GestionUsuarios';
import Pruebas from './pages/Pruebas';
import AccesoDenegado from './pages/AccesoDenegado';
import Estadisticas from './pages/Estadisticas';
import { logSiteVisitOncePerSession } from './services/analytics';

const ROLE_ADMIN = 'Administrador' as const;
const ROLE_INSTRUCTOR = 'Instructor' as const;
const ROLE_MICRO = 'Microscopía' as const;

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

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <SiteVisitTracker />
        <SpellcheckEnabler />
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
            path="/editar-home"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <EditarHome />
              </PrivateRoute>
            }
          />
          <Route
            path="/editar-inicio"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO]}>
                <EditarInicio />
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
            path="/pruebas"
            element={
              <PrivateRoute allowedRoles={[ROLE_ADMIN, ROLE_MICRO, ROLE_INSTRUCTOR]}>
                <Pruebas />
              </PrivateRoute>
            }
          />
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
      </Router>
    </AuthProvider>
  );
};

export default App;
