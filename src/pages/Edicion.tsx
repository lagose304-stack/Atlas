import React from 'react';
import { Link } from 'react-router-dom';

// --- Styles ---
const styles: { [key: string]: React.CSSProperties } = {
    container: {
        padding: '40px 20px',
        fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        maxWidth: '800px',
        margin: '40px auto',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
    },
    header: {
        textAlign: 'center',
        borderBottom: '1px solid #e0e0e0',
        paddingBottom: '20px',
        marginBottom: '30px',
        fontSize: '2.5em',
        fontWeight: 700,
        color: '#2c3e50',
    },
    section: {
        backgroundColor: '#fdfdfd',
        border: '1px solid #ecf0f1',
        borderRadius: '10px',
        padding: '25px',
        marginBottom: '25px',
        transition: 'box-shadow 0.3s ease',
    },
    sectionTitle: {
        margin: '0 0 20px 0',
        color: '#34495e',
        textAlign: 'center',
        fontSize: '1.8em',
        fontWeight: 600,
    },
    button: {
        padding: '12px 25px',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#3498db',
        color: 'white',
        fontSize: '1em',
        fontWeight: 500,
        transition: 'background-color 0.3s ease, transform 0.2s ease',
        textDecoration: 'none',
        display: 'inline-block',
        textAlign: 'center',
    },
    buttonContainer: {
        display: 'flex',
        justifyContent: 'center',
        gap: '15px',
        marginTop: '20px',
    },
    backButton: {
        display: 'inline-block',
        marginBottom: '30px',
        padding: '10px 20px',
        border: '1px solid #bdc3c7',
        borderRadius: '8px',
        cursor: 'pointer',
        backgroundColor: '#ecf0f1',
        color: '#34495e',
        textDecoration: 'none',
        fontWeight: 600,
        transition: 'background-color 0.3s ease, box-shadow 0.3s ease',
    }
};

const Edicion: React.FC = () => {
  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Página de Edición</h1>
      <Link to="/" style={styles.backButton}>
          Regresar al Inicio
      </Link>
      
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Temario</h2>
        <div style={styles.buttonContainer}>
            <Link to="/temario" style={styles.button}>
                Ir a Temario
            </Link>
        </div>
      </div>

      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Placas</h2>
        <div style={styles.buttonContainer}>
            <Link to="/placas" style={styles.button}>
                Ir a Placas
            </Link>
        </div>
      </div>

      {/* Aquí puedes agregar más secciones en el futuro */}
      {/* 
      <div style={styles.section}>
        <h2 style={styles.sectionTitle}>Otra Sección</h2>
        <p>Contenido de otra sección...</p>
      </div>
      */}

    </div>
  );
};

export default Edicion;
