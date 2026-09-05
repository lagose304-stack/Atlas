import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Atom,
  Columns2,
  Compass,
  Microscope,
  Move,
  Sparkles,
  ZoomIn,
} from 'lucide-react';
import Header from '../components/Header';
import Footer from '../components/Footer';

const Herramientas: React.FC = () => {
  return (
    <div style={s.page}>
      <Header />
      <main style={s.main}>
        <h1
          id="herramientas-title"
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: 0,
          }}
        >
          Herramientas — Atlas de Histología
        </h1>

        {/* Tools Catalog Grid */}
        <section style={s.toolsGrid} aria-label="Catálogo de herramientas">
          {/* Tool 1: Versus de Placas - Rich Visual Card */}
          <article className="versus-featured-card" style={s.toolCard}>
            <div style={s.toolCardGlowTop} aria-hidden="true" />
            <div style={s.toolCardGlowBottom} aria-hidden="true" />

            <div style={s.toolCardTop}>
              <div style={s.toolIconBadge}>
                <Columns2 size={26} />
              </div>
              <div style={s.badgesGroup}>
                <span style={s.toolBadgeNew}>Modo Dual</span>
                <span style={s.toolBadgeAvailable}>Disponible</span>
              </div>
            </div>

            <div style={s.cardHeaderContent}>
              <h2 style={s.toolTitle}>Versus de Placas</h2>
              <p style={s.toolDescription}>
                Compara dos placas histológicas frente a frente en tiempo real.
              </p>
            </div>

            {/* Visual Interactive Showcase Graphic */}
            <div style={s.visualPreviewBox}>
              {/* Left Pane Mockup */}
              <div style={s.previewPaneLeft}>
                <div style={s.previewPlateBadgeA}>A</div>
                <div style={s.previewCellPatternA}>
                  <div style={s.cellCircle1} />
                  <div style={s.cellCircle2} />
                  <div style={s.cellCircle3} />
                </div>
                <span style={s.previewPaneLabel}>Placa A</span>
              </div>

              {/* Central Glowing VS Divider */}
              <div style={s.previewVsDivider}>
                <div style={s.previewDividerLine} />
                <div style={s.previewVsBadge}>
                  <span>VS</span>
                </div>
                <div style={s.previewDividerLine} />
              </div>

              {/* Right Pane Mockup */}
              <div style={s.previewPaneRight}>
                <div style={s.previewPlateBadgeB}>B</div>
                <div style={s.previewCellPatternB}>
                  <div style={s.cellCircle4} />
                  <div style={s.cellCircle5} />
                  <div style={s.cellCircle6} />
                </div>
                <span style={s.previewPaneLabel}>Placa B</span>
              </div>

              {/* Floating micro indicators */}
              <div style={s.previewFloatingControls}>
                <div style={s.previewControlPill}>
                  <ZoomIn size={12} />
                  <span>Zoom Sincronizado</span>
                </div>
                <div style={s.previewControlPill}>
                  <Move size={12} />
                  <span>Desplazamiento Espejo</span>
                </div>
              </div>
            </div>

            <div style={s.toolCardFooter}>
              <Link to="/herramientas/comparador" className="versus-action-btn" style={s.toolActionBtn}>
                <span>Abrir Versus de Placas</span>
                <ArrowRight size={18} />
              </Link>
            </div>
          </article>

          {/* Upcoming Tools Card - Spoiler-Free Abstract Lab Showcase */}
          <article className="upcoming-featured-card" style={s.upcomingCard}>
            <div style={s.upcomingGlowTop} aria-hidden="true" />
            <div style={s.upcomingGlowBottom} aria-hidden="true" />

            <div style={s.toolCardTop}>
              <div style={s.upcomingIconBadge}>
                <Sparkles size={24} />
              </div>
              <div style={s.badgesGroup}>
                <span style={s.upcomingBadgeLab}>Laboratorio I+D</span>
                <span style={s.upcomingBadgePill}>
                  <span style={s.pulseDot} /> En Desarrollo
                </span>
              </div>
            </div>

            <div style={s.cardHeaderContent}>
              <h2 style={s.upcomingTitle}>Más Herramientas en Camino</h2>
            </div>

            {/* Abstract Mystery Modules Showcase (Zero Spoilers) */}
            <div style={s.upcomingVisualGrid}>
              {/* Mystery Module 1 */}
              <div style={s.upcomingFeatureCard}>
                <div style={s.upcomingFeatureIconBoxA}>
                  <Microscope size={20} />
                </div>
                <div style={s.upcomingFeatureInfo}>
                  <span style={s.upcomingFeatureName}>Módulo Interactivo 01</span>
                  <div style={s.mysteryWaveContainer}>
                    <div style={{ ...s.mysteryBar, width: '65%' }} />
                    <div style={{ ...s.mysteryBar, width: '40%' }} />
                  </div>
                </div>
                <span style={s.mysteryBadgeStatus}>En progreso</span>
              </div>

              {/* Mystery Module 2 */}
              <div style={s.upcomingFeatureCard}>
                <div style={s.upcomingFeatureIconBoxB}>
                  <Compass size={20} />
                </div>
                <div style={s.upcomingFeatureInfo}>
                  <span style={s.upcomingFeatureName}>Módulo Interactivo 02</span>
                  <div style={s.mysteryWaveContainer}>
                    <div style={{ ...s.mysteryBar, width: '55%' }} />
                    <div style={{ ...s.mysteryBar, width: '75%' }} />
                  </div>
                </div>
                <span style={s.mysteryBadgeStatus}>En progreso</span>
              </div>

              {/* Mystery Module 3 */}
              <div style={s.upcomingFeatureCard}>
                <div style={s.upcomingFeatureIconBoxC}>
                  <Atom size={20} />
                </div>
                <div style={s.upcomingFeatureInfo}>
                  <span style={s.upcomingFeatureName}>Módulo Interactivo 03</span>
                  <div style={s.mysteryWaveContainer}>
                    <div style={{ ...s.mysteryBar, width: '70%' }} />
                    <div style={{ ...s.mysteryBar, width: '45%' }} />
                  </div>
                </div>
                <span style={s.mysteryBadgeStatus}>En progreso</span>
              </div>
            </div>

            <div style={s.upcomingFooter}>
              <div style={s.upcomingFooterPill}>
                <Sparkles size={14} color="#0284c7" />
                <span>Nuevas experiencias interactivas disponibles próximamente</span>
              </div>
            </div>
          </article>
        </section>
      </main>
      <Footer />
    </div>
  );
};

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 'clamp(8px, 2vw, 20px)',
    boxSizing: 'border-box',
    color: '#0f172a',
    fontFamily: '"Montserrat", "Segoe UI", sans-serif',
    background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
  },
  main: {
    width: '100%',
    maxWidth: 1280,
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'clamp(14px, 2vw, 22px)',
    paddingBottom: 36,
    boxSizing: 'border-box',
  },
  hero: {
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: 'clamp(16px, 2.4vw, 24px) clamp(20px, 3.2vw, 32px)',
    borderRadius: 22,
    border: '1px solid rgba(186, 230, 253, 0.85)',
    background:
      'linear-gradient(135deg, rgba(255, 255, 255, 0.98), rgba(239, 246, 255, 0.96) 52%, rgba(245, 243, 255, 0.96))',
    boxShadow: '0 10px 30px rgba(12, 56, 82, 0.07)',
    boxSizing: 'border-box',
  },
  heroGlowOne: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: '50%',
    top: -110,
    right: -40,
    zIndex: -1,
    background: 'radial-gradient(circle, rgba(56, 189, 248, 0.25), transparent 70%)',
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: '50%',
    bottom: -110,
    left: '25%',
    zIndex: -1,
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.16), transparent 70%)',
  },
  heroContent: {
    maxWidth: 760,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  eyebrowRow: {
    marginBottom: 2,
  },
  eyebrow: {
    width: 'fit-content',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 11px',
    borderRadius: 999,
    color: '#0369a1',
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
    fontSize: '.72rem',
    fontWeight: 800,
    letterSpacing: '.04em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '2px 0 4px',
    fontSize: 'clamp(1.45rem, 3vw, 1.95rem)',
    lineHeight: 1.15,
    fontWeight: 900,
    letterSpacing: '-.035em',
    background: 'linear-gradient(120deg, #0c3852 20%, #0284c7 65%, #4f46e5)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  heroText: {
    maxWidth: 680,
    margin: 0,
    color: '#475569',
    fontSize: 'clamp(.86rem, 1.4vw, .95rem)',
    lineHeight: 1.45,
    fontWeight: 500,
  },
  heroMark: {
    flexShrink: 0,
    width: 54,
    height: 54,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 18,
    color: '#0284c7',
    background: 'rgba(255, 255, 255, 0.9)',
    border: '1px solid rgba(186, 230, 253, 0.9)',
    boxShadow: '0 8px 22px rgba(2, 132, 199, 0.15)',
  },
  toolsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
    gap: 'clamp(16px, 2.5vw, 24px)',
    alignItems: 'stretch',
  },
  toolCard: {
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: 'clamp(20px, 3.2vw, 30px)',
    borderRadius: 24,
    border: '1.5px solid rgba(186, 230, 253, 0.95)',
    background: 'linear-gradient(150deg, #ffffff 0%, #f8fcff 45%, #f0f7fb 100%)',
    boxShadow: '0 16px 40px rgba(12, 56, 82, 0.08), 0 2px 8px rgba(12, 56, 82, 0.03)',
    boxSizing: 'border-box',
  },
  toolCardGlowTop: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(2, 132, 199, 0.18), transparent 70%)',
    zIndex: -1,
  },
  toolCardGlowBottom: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 170,
    height: 170,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.12), transparent 70%)',
    zIndex: -1,
  },
  toolCardTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  toolIconBadge: {
    width: 52,
    height: 52,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #0c3852 0%, #0284c7 100%)',
    color: '#ffffff',
    boxShadow: '0 8px 22px rgba(2, 132, 199, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
    border: '1px solid rgba(186, 230, 253, 0.6)',
  },
  badgesGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
  },
  toolBadgeNew: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '.7rem',
    fontWeight: 850,
    color: '#0369a1',
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
  },
  toolBadgeAvailable: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '.7rem',
    fontWeight: 850,
    color: '#065f46',
    background: '#d1fae5',
    border: '1px solid #a7f3d0',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
  },
  cardHeaderContent: {
    marginBottom: 16,
  },
  toolTitle: {
    margin: '0 0 6px',
    fontSize: 'clamp(1.25rem, 2.2vw, 1.5rem)',
    fontWeight: 900,
    color: '#0c3852',
    letterSpacing: '-.025em',
  },
  toolDescription: {
    margin: 0,
    fontSize: '.92rem',
    color: '#475569',
    lineHeight: 1.55,
    fontWeight: 500,
  },

  /* Visual Preview Box Styles */
  visualPreviewBox: {
    position: 'relative',
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    gap: 0,
    height: 160,
    borderRadius: 18,
    border: '1.5px solid #bae6fd',
    background: 'linear-gradient(135deg, #0c3852 0%, #10415e 60%, #155275 100%)',
    overflow: 'hidden',
    marginBottom: 22,
    boxShadow: '0 10px 28px rgba(12, 56, 82, 0.2), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
  },
  previewPaneLeft: {
    position: 'relative',
    height: '100%',
    background: 'radial-gradient(circle at 40% 40%, rgba(244, 63, 94, 0.28), rgba(12, 56, 82, 0.85) 75%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    overflow: 'hidden',
  },
  previewPlateBadgeA: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 24,
    height: 24,
    borderRadius: 8,
    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
    color: '#ffffff',
    fontWeight: 900,
    fontSize: '0.74rem',
    display: 'grid',
    placeItems: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    border: '1px solid #7dd3fc',
    zIndex: 2,
  },
  previewCellPatternA: {
    position: 'absolute',
    inset: 0,
    opacity: 0.65,
  },
  cellCircle1: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: '50%',
    top: 20,
    left: 20,
    border: '2px solid rgba(244, 63, 94, 0.5)',
    background: 'radial-gradient(circle, rgba(244, 63, 94, 0.4), transparent 60%)',
  },
  cellCircle2: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: '50%',
    bottom: 30,
    right: 25,
    border: '2px solid rgba(192, 132, 252, 0.5)',
    background: 'radial-gradient(circle, rgba(192, 132, 252, 0.35), transparent 60%)',
  },
  cellCircle3: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: '50%',
    top: 60,
    right: 40,
    border: '1.5px solid rgba(251, 113, 133, 0.6)',
    background: 'rgba(251, 113, 133, 0.3)',
  },

  /* Central VS Divider */
  previewVsDivider: {
    position: 'relative',
    height: '100%',
    width: 32,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  previewDividerLine: {
    flex: 1,
    width: 2,
    background: 'linear-gradient(180deg, transparent, #38bdf8, transparent)',
  },
  previewVsBadge: {
    width: 30,
    height: 30,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #0284c7, #2563eb)',
    color: '#ffffff',
    fontSize: '0.68rem',
    fontWeight: 900,
    letterSpacing: '0.04em',
    display: 'grid',
    placeItems: 'center',
    boxShadow: '0 0 16px rgba(56, 189, 248, 0.8), 0 4px 10px rgba(0, 0, 0, 0.4)',
    border: '2px solid #ffffff',
  },

  /* Right Pane Mockup */
  previewPaneRight: {
    position: 'relative',
    height: '100%',
    background: 'radial-gradient(circle at 60% 40%, rgba(16, 185, 129, 0.28), rgba(12, 56, 82, 0.85) 75%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 10,
    overflow: 'hidden',
  },
  previewPlateBadgeB: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    borderRadius: 8,
    background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
    color: '#ffffff',
    fontWeight: 900,
    fontSize: '0.74rem',
    display: 'grid',
    placeItems: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
    border: '1px solid #c4b5fd',
    zIndex: 2,
  },
  previewCellPatternB: {
    position: 'absolute',
    inset: 0,
    opacity: 0.65,
  },
  cellCircle4: {
    position: 'absolute',
    width: 65,
    height: 65,
    borderRadius: '50%',
    top: 25,
    right: 20,
    border: '2px solid rgba(16, 185, 129, 0.5)',
    background: 'radial-gradient(circle, rgba(16, 185, 129, 0.4), transparent 60%)',
  },
  cellCircle5: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: '50%',
    bottom: 28,
    left: 25,
    border: '2px solid rgba(45, 212, 191, 0.5)',
    background: 'radial-gradient(circle, rgba(45, 212, 191, 0.35), transparent 60%)',
  },
  cellCircle6: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: '50%',
    top: 55,
    left: 45,
    border: '1.5px solid rgba(52, 211, 153, 0.6)',
    background: 'rgba(52, 211, 153, 0.3)',
  },
  previewPaneLabel: {
    position: 'relative',
    zIndex: 2,
    fontSize: '0.72rem',
    fontWeight: 800,
    color: '#e0f2fe',
    textShadow: '0 2px 6px rgba(0, 0, 0, 0.6)',
    letterSpacing: '0.03em',
  },

  previewFloatingControls: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    zIndex: 4,
    pointerEvents: 'none',
  },
  previewControlPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '3px 8px',
    borderRadius: 999,
    background: 'rgba(12, 56, 82, 0.85)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: '1px solid rgba(186, 230, 253, 0.4)',
    color: '#e0f2fe',
    fontSize: '0.64rem',
    fontWeight: 750,
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  },

  toolCardFooter: {
    display: 'flex',
    alignItems: 'center',
    marginTop: 'auto',
  },
  toolActionBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    padding: '13px 20px',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #0c3852 0%, #0284c7 100%)',
    color: '#ffffff',
    fontSize: '.92rem',
    fontWeight: 850,
    textDecoration: 'none',
    boxShadow: '0 8px 24px rgba(2, 132, 199, 0.28), inset 0 1px 0 rgba(255, 255, 255, 0.25)',
    border: '1px solid rgba(186, 230, 253, 0.5)',
    boxSizing: 'border-box',
    letterSpacing: '-0.01em',
  },

  /* Upcoming Card Styles */
  upcomingCard: {
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: 'clamp(20px, 3.2vw, 30px)',
    borderRadius: 24,
    border: '1.5px dashed rgba(186, 230, 253, 0.95)',
    background: 'linear-gradient(150deg, rgba(255, 255, 255, 0.96) 0%, rgba(240, 249, 255, 0.85) 50%, rgba(245, 243, 255, 0.75) 100%)',
    boxShadow: '0 16px 40px rgba(12, 56, 82, 0.05)',
    boxSizing: 'border-box',
  },
  upcomingGlowTop: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 200,
    height: 200,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(14, 165, 233, 0.14), transparent 70%)',
    zIndex: -1,
  },
  upcomingGlowBottom: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 170,
    height: 170,
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(168, 85, 247, 0.12), transparent 70%)',
    zIndex: -1,
  },
  upcomingIconBadge: {
    width: 52,
    height: 52,
    display: 'grid',
    placeItems: 'center',
    borderRadius: 16,
    background: 'linear-gradient(135deg, #0284c7 0%, #6366f1 100%)',
    color: '#ffffff',
    boxShadow: '0 8px 22px rgba(99, 102, 241, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
    border: '1px solid rgba(199, 210, 254, 0.6)',
  },
  upcomingBadgeLab: {
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '.7rem',
    fontWeight: 850,
    color: '#0369a1',
    background: '#e0f2fe',
    border: '1px solid #bae6fd',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
  },
  upcomingBadgePill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 10px',
    borderRadius: 999,
    fontSize: '.7rem',
    fontWeight: 850,
    color: '#4f46e5',
    background: '#eef2ff',
    border: '1px solid #c7d2fe',
    letterSpacing: '.04em',
    textTransform: 'uppercase',
  },
  pulseDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#6366f1',
    boxShadow: '0 0 6px #6366f1',
  },
  upcomingTitle: {
    margin: '0 0 4px',
    fontSize: 'clamp(1.25rem, 2.2vw, 1.5rem)',
    fontWeight: 900,
    color: '#0c3852',
    letterSpacing: '-.025em',
  },

  /* Upcoming Features Visual Grid */
  upcomingVisualGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 20,
    marginTop: 6,
  },
  upcomingFeatureCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 14px',
    borderRadius: 14,
    background: 'rgba(255, 255, 255, 0.92)',
    border: '1px solid rgba(186, 230, 253, 0.85)',
    boxShadow: '0 2px 8px rgba(12, 56, 82, 0.03)',
    transition: 'all 0.18s ease',
  },
  upcomingFeatureIconBoxA: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #e0f2fe, #bae6fd)',
    color: '#0284c7',
    border: '1px solid #7dd3fc',
    flexShrink: 0,
  },
  upcomingFeatureIconBoxB: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    color: '#d97706',
    border: '1px solid #fcd34d',
    flexShrink: 0,
  },
  upcomingFeatureIconBoxC: {
    width: 38,
    height: 38,
    borderRadius: 10,
    display: 'grid',
    placeItems: 'center',
    background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)',
    color: '#7c3aed',
    border: '1px solid #c4b5fd',
    flexShrink: 0,
  },
  upcomingFeatureInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    flex: 1,
    minWidth: 0,
  },
  upcomingFeatureName: {
    fontSize: '0.86rem',
    fontWeight: 800,
    color: '#0f172a',
    lineHeight: 1.3,
  },
  mysteryWaveContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  mysteryBar: {
    height: 4,
    borderRadius: 999,
    background: 'linear-gradient(90deg, #cbd5e1, #e2e8f0)',
  },
  mysteryBadgeStatus: {
    fontSize: '0.68rem',
    fontWeight: 800,
    color: '#64748b',
    background: '#f1f5f9',
    padding: '3px 8px',
    borderRadius: 6,
    border: '1px solid #e2e8f0',
    flexShrink: 0,
  },

  upcomingFooter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 'auto',
    paddingTop: 8,
  },
  upcomingFooterPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    padding: '6px 14px',
    borderRadius: 999,
    background: 'rgba(255, 255, 255, 0.85)',
    border: '1px solid rgba(186, 230, 253, 0.75)',
    color: '#0369a1',
    fontSize: '0.75rem',
    fontWeight: 750,
    boxShadow: '0 2px 8px rgba(12, 56, 82, 0.04)',
  },
};

export default Herramientas;
