import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Eye,
  Layers3,
  Mail,
  Microscope,
  Monitor,
  Search,
  Smartphone,
  Sparkles,
  Tablet,
  Wrench,
} from 'lucide-react';
import Footer from '../components/Footer';
import Header from '../components/Header';
import ContentBlockRenderer from '../components/ContentBlockRenderer';
import { OPEN_HEADER_SEARCH_EVENT } from '../constants/uiEvents';
import type { ContentBlock } from '../types/contentBlocks';
import { getRenderableBlocks } from '../services/contentPublication';
import bombillaIcon from '../assets/icons/bombilla.ico';
import '../styles/home.css';

const Home: React.FC = () => {
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [showDeviceTip, setShowDeviceTip] = useState(false);
  const [isDeviceTipLeaving, setIsDeviceTipLeaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchBlocks = async () => {
      try {
        const blocks = await getRenderableBlocks('home_page', 0);
        if (isMounted) {
          setContentBlocks(blocks as ContentBlock[]);
        }
      } catch (error) {
        console.error('Error fetching home content blocks:', error);
      }
    };

    void fetchBlocks();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 640px)');

    const syncDeviceTipVisibility = () => {
      const isPhoneViewport = mediaQuery.matches;
      setShowDeviceTip(isPhoneViewport);
      setIsDeviceTipLeaving(false);
    };

    syncDeviceTipVisibility();
    mediaQuery.addEventListener('change', syncDeviceTipVisibility);

    return () => {
      mediaQuery.removeEventListener('change', syncDeviceTipVisibility);
    };
  }, []);

  useEffect(() => {
    if (!showDeviceTip) {
      return;
    }

    let exitTimer: number | undefined;

    const hideTimer = window.setTimeout(() => {
      setIsDeviceTipLeaving(true);
      exitTimer = window.setTimeout(() => {
        setShowDeviceTip(false);
      }, 360);
    }, 3000);

    return () => {
      window.clearTimeout(hideTimer);
      if (typeof exitTimer === 'number') {
        window.clearTimeout(exitTimer);
      }
    };
  }, [showDeviceTip]);

  const featuredPublication = useMemo(() => {
    const examBlock = contentBlocks.find(b => b.block_type === 'exam_week');
    if (examBlock) return [examBlock];
    return contentBlocks.filter(b => b.block_type === 'weekly_publication').slice(0, 1);
  }, [contentBlocks]);

  return (
    <div className="atlas-home-page">
      <Header />

      {showDeviceTip && (
        <aside
          className={`home-device-tip ${isDeviceTipLeaving ? 'home-device-tip-leaving' : 'home-device-tip-entering'}`}
          role="status"
          aria-live="polite"
          aria-label="Sugerencia de uso del sitio"
        >
          <div className="home-device-tip-float">
            <div className="home-device-tip-header">
              <div className="home-device-tip-lamp" aria-hidden="true">
                <img className="home-device-tip-lamp-icon" src={bombillaIcon} alt="" aria-hidden="true" />
              </div>
              <div className="home-device-tip-eyebrow">Sugerencia</div>
            </div>

            <div className="home-device-tip-content">
              <p className="home-device-tip-text">
                Se recomienda utilizar en computadoras, tablets o iPads.
              </p>
            </div>

            <div className="home-device-tip-progress" aria-hidden="true">
              <div className="home-device-tip-progress-bar" />
            </div>
          </div>
        </aside>
      )}

      <main className="atlas-home-main public-editor-main has-editor-content">
        <h1
          id="home-main-title"
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
          Atlas de Histología — Laboratorio de Histología FCM UNAH
        </h1>

        {featuredPublication.length > 0 && (
          <section className="home-weekly-publication home-reveal" aria-label="Publicación destacada">
            <ContentBlockRenderer blocks={featuredPublication} />
          </section>
        )}

        <section className="home-learning-route home-reveal" aria-labelledby="home-route-title">
          {/* Fondo y decoraciones de ambientación */}
          <span className="home-route-edge-bar" aria-hidden="true" />
          <span className="home-route-glow home-route-glow-cyan" aria-hidden="true" />
          <span className="home-route-glow home-route-glow-violet" aria-hidden="true" />
          <span className="home-route-orbit" aria-hidden="true" />
          <span className="home-route-dots home-route-dots-left" aria-hidden="true" />
          <span className="home-route-dots home-route-dots-right" aria-hidden="true" />
          <span className="home-route-shine" aria-hidden="true" />

          <div className="home-route-intro">
            <span className="home-route-badge"><Microscope size={15} /> Primera vez en el atlas</span>
            <h2 id="home-route-title">Así puedes comenzar</h2>
            <div className="home-route-title-bar" aria-hidden="true" />
            <p>Tres pasos para convertir cada observación en aprendizaje.</p>
          </div>

          <ol className="home-route-steps">
            <li className="home-step-item home-step-one">
              <span className="home-step-number">01</span>
              <div className="home-step-icon"><BookOpen size={20} /></div>
              <div><strong>Elige</strong><p>Abre el tema que estás estudiando.</p></div>
            </li>
            <li className="home-step-item home-step-two">
              <span className="home-step-number">02</span>
              <div className="home-step-icon"><Eye size={20} /></div>
              <div><strong>Observa</strong><p>Compara placas y reconoce estructuras.</p></div>
            </li>
            <li className="home-step-item home-step-three">
              <span className="home-step-number">03</span>
              <div className="home-step-icon"><Brain size={20} /></div>
              <div><strong>Comprueba</strong><p>Refuerza lo aprendido con una evaluación.</p></div>
            </li>
          </ol>
        </section>

        <section className="home-study-tools home-reveal" aria-labelledby="home-tools-title">
          <div className="home-tools-heading">
            <div>
              <span className="home-eyebrow"><Sparkles size={15} /> Herramientas para estudiar</span>
              <h2 id="home-tools-title">Continúa tu recorrido</h2>
            </div>
            <p>
              Elige el recurso que necesitas ahora: explorar contenido, localizar una estructura
              o comprobar cuánto aprendiste.
            </p>
          </div>

          <div className="home-bento-grid">
            <Link to="/temario" className="home-bento-card home-bento-atlas">
              <span className="home-card-edge-bar" aria-hidden="true" />
              <span className="home-card-shine" aria-hidden="true" />
              <span className="home-orbit home-orbit-one" aria-hidden="true" />
              <span className="home-orbit home-orbit-two" aria-hidden="true" />
              <div className="home-card-icon home-card-icon-primary"><BookOpen size={24} /></div>
              <div className="home-card-copy">
                <span className="home-card-kicker">Atlas completo</span>
                <h2>Explora el temario</h2>
                <p>Accede a temas, subtemas y placas histológicas organizadas para acompañar cada etapa del curso.</p>
              </div>
              <div className="home-atlas-map" aria-hidden="true">
                <span><Layers3 size={16} /> Temas</span>
                <i />
                <span><Microscope size={16} /> Placas</span>
                <i />
                <span><Eye size={16} /> Detalles</span>
              </div>
              <span className="home-card-action">Abrir el atlas <ArrowRight size={17} /></span>
            </Link>

            <button
              type="button"
              className="home-bento-card home-bento-search"
              onClick={() => window.dispatchEvent(new Event(OPEN_HEADER_SEARCH_EVENT))}
              aria-label="Abrir el buscador de temas y subtemas"
              aria-controls="atlas-header-search-panel"
            >
              <span className="home-card-edge-bar" aria-hidden="true" />
              <div className="home-card-icon home-card-icon-cyan"><Search size={22} /></div>
              <div className="home-card-copy">
                <span className="home-card-kicker">Encuentra en segundos</span>
                <h2>Busca una estructura</h2>
                <p>Usa la lupa del encabezado para localizar rápidamente cualquier tema o subtema.</p>
              </div>
              <div className="home-search-demo" aria-hidden="true">
                <Search size={15} />
                <span>Epitelio, tejido, órgano…</span>
                <kbd>Abrir</kbd>
              </div>
            </button>

            <Link to="/evaluaciones" className="home-bento-card home-bento-evaluation">
              <span className="home-card-edge-bar" aria-hidden="true" />
              <div className="home-card-icon home-card-icon-violet"><ClipboardCheck size={23} /></div>
              <div className="home-card-copy">
                <span className="home-card-kicker">Ponlo en práctica</span>
                <h2>Evalúa lo aprendido</h2>
                <p>Identifica estructuras, responde preguntas y descubre qué temas conviene repasar.</p>
              </div>
              <div className="home-evaluation-meter" aria-hidden="true">
                <span><CheckCircle2 size={15} /> Progreso</span>
                <div><i /></div>
                <strong>Lista para comenzar</strong>
              </div>
              <span className="home-card-action">Ver evaluaciones <ArrowRight size={17} /></span>
            </Link>
          </div>
        </section>

        <section className="home-site-notice home-reveal" aria-labelledby="home-site-notice-title">
          {/* Fondo y ambientación decorativa */}
          <span className="home-notice-edge-bar" aria-hidden="true" />
          <span className="home-notice-glow home-notice-glow-amber" aria-hidden="true" />
          <span className="home-notice-glow home-notice-glow-cyan" aria-hidden="true" />
          <span className="home-notice-orbit" aria-hidden="true" />
          <span className="home-notice-dots" aria-hidden="true" />
          <span className="home-notice-shine" aria-hidden="true" />

          <div className="home-notice-intro">
            <div className="home-notice-symbol" aria-hidden="true"><Wrench size={24} /></div>
            <div>
              <span className="home-notice-badge"><span className="home-notice-pulse-dot" aria-hidden="true" /><AlertTriangle size={13} /> Sitio en desarrollo activo</span>
              <h2 id="home-site-notice-title">Una experiencia que seguimos mejorando</h2>
              <div className="home-notice-title-bar" aria-hidden="true" />
              <p>
                El Atlas es un proyecto vivo y continúa en constante evolución. Podrías encontrar
                algunos detalles o ajustes visuales mientras seguimos perfeccionando la plataforma.
              </p>
            </div>
          </div>

          <div className="home-notice-recommendations">
            <div className="home-notice-item home-notice-item-desktop">
              <span className="home-notice-item-icon" aria-hidden="true"><Monitor size={18} /><Tablet size={14} /></span>
              <div>
                <strong>Mejor experiencia</strong>
                <p>Utiliza una computadora, tablet o dispositivo de pantalla grande.</p>
              </div>
            </div>

            <div className="home-notice-item home-notice-item-mobile">
              <span className="home-notice-item-icon" aria-hidden="true"><Smartphone className="home-notice-phone" size={19} /></span>
              <div>
                <strong>Desde el celular</strong>
                <p>Te recomendamos navegar con la pantalla en modo horizontal.</p>
              </div>
            </div>

            <a
              className="home-notice-item home-notice-contact"
              href="mailto:atlashistolabfcm@gmail.com?subject=Reporte%20de%20error%20-%20Atlas%20de%20Histolog%C3%ADa"
              aria-label="Reportar un error a atlashistolabfcm@gmail.com"
            >
              <span className="home-notice-item-icon" aria-hidden="true"><Mail size={19} /></span>
              <div>
                <strong>¿Encontraste un error o tienes sugerencias?</strong>
                <p>Escríbenos a <span className="home-notice-email-highlight">atlashistolabfcm@gmail.com</span></p>
              </div>
              <span className="home-notice-action-btn" aria-hidden="true">Reportar <ArrowRight size={15} /></span>
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Home;



