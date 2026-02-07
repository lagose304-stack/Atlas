import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Edicion from './pages/Edicion';
import Temario from './pages/Temario';
import Placas from './pages/Placas';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/edicion" element={<Edicion />} />
        <Route path="/temario" element={<Temario />} />
        <Route path="/placas" element={<Placas />} />
      </Routes>
    </Router>
  );
};

export default App;
