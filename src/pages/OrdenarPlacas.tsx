import React from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BackButton from '../components/BackButton';
import PlacasOrderManager from '../components/PlacasOrderManager';
import { useSmartBackNavigation } from '../hooks/useSmartBackNavigation';

const OrdenarPlacas: React.FC = () => {
  const goBack = useSmartBackNavigation('/edicion');
  return <div style={s.page}><Header /><main style={s.main}><BackButton onClick={goBack} />
    <div style={s.banner}><span style={s.icon}>🔬</span><div><strong>Orden de placas</strong><p style={s.hint}>Cada placa solo puede moverse dentro de su sección actual. Los cambios se aplican al pulsar <strong>Guardar orden</strong>.</p></div></div>
    <PlacasOrderManager />
  </main><Footer /></div>;
};

const s: Record<string, React.CSSProperties> = {
  page:{minHeight:'100vh',display:'flex',flexDirection:'column',fontFamily:'"Montserrat","Segoe UI",sans-serif'}, main:{flex:1,width:'100%',maxWidth:1300,margin:'0 auto',padding:'clamp(16px,3vw,40px) clamp(12px,3vw,40px) 120px',boxSizing:'border-box'}, banner:{display:'flex',gap:14,background:'linear-gradient(135deg,#fef9c3,#fef3c7)',border:'1.5px solid #fde68a',borderRadius:14,padding:'16px 20px',color:'#78350f'}, icon:{fontSize:'1.6em'}, hint:{margin:'4px 0 0',fontSize:'.88em',color:'#92400e'}
};
export default OrdenarPlacas;
