import React from 'react';
import { fetchTotalSiteViews } from '../services/analytics';

const FloatingVisitorsIndicator: React.FC = () => {
  const [totalViews, setTotalViews] = React.useState<number>(0);

  React.useEffect(() => {
    let isMounted = true;

    const loadTotalViews = async () => {
      const count = await fetchTotalSiteViews();
      if (isMounted) {
        setTotalViews(count);
      }
    };

    loadTotalViews();
    const intervalId = window.setInterval(loadTotalViews, 60000);

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const formattedTotalViews = new Intl.NumberFormat('es-HN').format(totalViews);

  return (
    <>
      <div
        style={s.wrap}
        title="Visualizaciones totales del sitio"
      >
        <strong style={s.count}>{formattedTotalViews}</strong>
        <span style={s.label}>Visualizaciones</span>
      </div>
    </>
  );
};

const s: { [key: string]: React.CSSProperties } = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: '#1a1f24',
    border: '1px solid #c9b485',
    borderRadius: '4px',
    padding: '6px 10px',
    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.5)',
    color: '#e4d2a1',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  },
  count: {
    fontSize: '0.85rem',
    color: '#f0dfa8',
    minWidth: '0',
    textAlign: 'right',
    fontWeight: 700,
  },
  label: {
    fontSize: '0.8rem',
    color: '#d4c292',
    letterSpacing: '0.02em',
    fontWeight: 500,
  },
};

export default FloatingVisitorsIndicator;
