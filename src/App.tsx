import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Home from './pages/Home';
import Edicion from './pages/Edicion';
import Temario from './pages/Temario';
import Placas from './pages/Placas';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
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
          
          {/* Ruta de fallback */}
          <Route path="*" element={<Home />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
