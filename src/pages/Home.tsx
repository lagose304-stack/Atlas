import React from 'react';
import { Link } from 'react-router-dom';

const Home: React.FC = () => {
  return (
    <div>
      <h1>Página de Inicio</h1>
      <Link to="/edicion">
        <button>Ir a Edición</button>
      </Link>
    </div>
  );
};

export default Home;
