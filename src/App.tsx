import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Home from './pages/Home';
import Edicion from './pages/Edicion';
import Temario from './pages/Temario';
import Placas from './pages/Placas';
import Subtemas from './pages/Subtemas';
import PlacasSubtema from './pages/PlacasSubtema';
import EditarHome from './pages/EditarHome';
import EditarSubtemas from './pages/EditarSubtemas';
import EditarPlacas from './pages/EditarPlacas';
import EliminarPlacas from './pages/EliminarPlacas';
import MoverPlaca from './pages/MoverPlaca';
import ListaEspera from './pages/ListaEspera';
import GestionUsuarios from './pages/GestionUsuarios';
import Pruebas from './pages/Pruebas';

const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Ruta pública */}
          <Route path="/" element={<Home />} />
          
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
            path="/temario"
            element={
              <PrivateRoute>
                <Temario />
              </PrivateRoute>
            }
          />
          <Route
            path="/placas"
            element={
              <PrivateRoute>
                <Placas />
              </PrivateRoute>
            }
          />
          <Route
            path="/editar-home"
            element={
              <PrivateRoute>
                <EditarHome />
              </PrivateRoute>
            }
          />
          <Route
            path="/editar-subtemas"
            element={
              <PrivateRoute>
                <EditarSubtemas />
              </PrivateRoute>
            }
          />
          <Route
            path="/editar-placas"
            element={
              <PrivateRoute>
                <EditarPlacas />
              </PrivateRoute>
            }
          />
          <Route
            path="/eliminar-placas"
            element={
              <PrivateRoute>
                <EliminarPlacas />
              </PrivateRoute>
            }
          />
          <Route
            path="/mover-placa"
            element={
              <PrivateRoute>
                <MoverPlaca />
              </PrivateRoute>
            }
          />
          <Route
            path="/lista-espera"
            element={
              <PrivateRoute>
                <ListaEspera />
              </PrivateRoute>
            }
          />
          <Route
            path="/gestion-usuarios"
            element={
              <PrivateRoute>
                <GestionUsuarios />
              </PrivateRoute>
            }
          />
          <Route
            path="/pruebas"
            element={
              <PrivateRoute>
                <Pruebas />
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
