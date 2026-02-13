import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoginForm from '../components/LoginForm';
import Footer from '../components/Footer';
import Header from '../components/Header';

const Home: React.FC = () => {
  const [showLogin, setShowLogin] = useState(false);
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  return (
    <div style={styles.container}>
      <Header />
      
      {/* Aquí irán más secciones del home */}
      
      {showLogin && <LoginForm onClose={() => setShowLogin(false)} />}
      
      <Footer />
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f7fa',
    position: 'relative',
  },
};

export default Home;
