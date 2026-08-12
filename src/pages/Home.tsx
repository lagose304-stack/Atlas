import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarDays,
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
    const fetchBlocks = async () => {
      try {
        const blocks = await getRenderableBlocks('home_page', 0);
        setContentBlocks(blocks as ContentBlock[]);
      } catch (error) {
        console.error('Error fetching home content blocks:', error);
      }
    };

    void fetchBlocks();
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

  const weeklyPublication = contentBlocks
    .filter(block => block.block_type === 'weekly_publication')
    .slice(0, 1);

  useEffect(() => {
    const sections = Array.from(document.querySelectorAll<HTMLElement>('.home-reveal'));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      sections.forEach(section => section.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -6% 0px',
    });

    sections.forEach(section => observer.observe(section));
    return () => observer.disconnect();
  }, [weeklyPublication.length]);

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

      <main className={`atlas-home-main public-editor-main${weeklyPublication.length > 0 ? ' has-editor-content' : ''}`}>
        <section className="home-semester-welcome home-reveal" aria-labelledby="home-welcome-title">
          <span className="home-welcome-glow home-welcome-glow-one" aria-hidden="true" />
          <span className="home-welcome-glow home-welcome-glow-two" aria-hidden="true" />

          <div className="home-welcome-copy">
            <span className="home-welcome-badge"><CalendarDays size={15} /> II PAC · 2026</span>
            <h1 id="home-welcome-title">Bienvenidos al<br /><em>Laboratorio de Histología</em></h1>
            <p>
              Comenzamos un nuevo período para observar, identificar y comprender los tejidos
              que construyen el cuerpo humano.
            </p>
            <div className="home-welcome-values" aria-label="Objetivos del laboratorio">
              <span><Eye size={15} /> Observa</span>
              <i />
              <span><Microscope size={15} /> Identifica</span>
              <i />
              <span><Brain size={15} /> Comprende</span>
            </div>
          </div>

          <div className="home-semester-emblem" aria-hidden="true">
            <span className="home-emblem-orbit home-emblem-orbit-outer" />
            <span className="home-emblem-orbit home-emblem-orbit-inner" />
            <div className="home-emblem-core">
              <Microscope size={24} />
              <strong>II</strong>
              <span>PAC 2026</span>
            </div>
            <span className="home-emblem-dot home-emblem-dot-one" />
            <span className="home-emblem-dot home-emblem-dot-two" />
            <span className="home-emblem-dot home-emblem-dot-three" />
          </div>
        </section>

        {weeklyPublication.length > 0 && (
          <section className="home-weekly-publication home-reveal" aria-label="Publicación de la semana">
            <ContentBlockRenderer blocks={weeklyPublication} />
          </section>
        )}

        <section className="home-histology-fact home-reveal" aria-labelledby="home-histology-fact-title">
          <div className="home-histology-fact-icon" aria-hidden="true">
            <Microscope size={24} />
          </div>

          <div className="home-histology-fact-copy">
            <span className="home-histology-fact-label">
              <Sparkles size={14} /> Dato histológico
            </span>
            <p id="home-histology-fact-title">
              <strong>¿Sabías que el tejido epitelial no posee vasos sanguíneos?</strong>{' '}
              Recibe oxígeno y nutrientes por difusión desde el tejido conjuntivo que se encuentra debajo.
            </p>
          </div>

          <div className="home-histology-tissue" aria-hidden="true">
            <span className="home-tissue-caption">Epitelio</span>
            <span className="home-tissue-cell home-tissue-cell-one" />
            <span className="home-tissue-cell home-tissue-cell-two" />
            <span className="home-tissue-cell home-tissue-cell-three" />
            <span className="home-tissue-cell home-tissue-cell-four" />
            <i className="home-tissue-membrane" />
            <i className="home-tissue-diffusion home-tissue-diffusion-one" />
            <i className="home-tissue-diffusion home-tissue-diffusion-two" />
            <i className="home-tissue-connective" />
            <span className="home-tissue-source">Tejido conectivo</span>
          </div>
        </section>

        <section className="home-learning-route home-reveal" aria-labelledby="home-route-title">
          <div className="home-route-intro">
            <span className="home-route-badge"><Microscope size={16} /> Primera vez en el atlas</span>
            <h2 id="home-route-title">Así puedes comenzar</h2>
            <p>Tres pasos para convertir cada observación en aprendizaje.</p>
          </div>

          <ol className="home-route-steps">
            <li>
              <span className="home-step-number">01</span>
              <div className="home-step-icon"><BookOpen size={20} /></div>
              <div><strong>Elige</strong><p>Abre el tema que estás estudiando.</p></div>
            </li>
            <li>
              <span className="home-step-number">02</span>
              <div className="home-step-icon"><Eye size={20} /></div>
              <div><strong>Observa</strong><p>Compara placas y reconoce estructuras.</p></div>
            </li>
            <li>
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
          <span className="home-notice-glow" aria-hidden="true" />

          <div className="home-notice-intro">
            <div className="home-notice-symbol" aria-hidden="true"><Wrench size={23} /></div>
            <div>
              <span className="home-notice-badge"><AlertTriangle size={14} /> Sitio en desarrollo</span>
              <h2 id="home-site-notice-title">Una experiencia que seguimos mejorando</h2>
              <p>
                El Atlas es un sitio nuevo y continúa en desarrollo, por lo que podrías encontrar
                algunos detalles o errores visuales mientras seguimos perfeccionándolo.
              </p>
            </div>
          </div>

          <div className="home-notice-recommendations">
            <div className="home-notice-item">
              <span className="home-notice-item-icon" aria-hidden="true"><Monitor size={19} /><Tablet size={15} /></span>
              <span><strong>Mejor experiencia</strong>Utiliza una computadora, tablet o dispositivo de pantalla grande.</span>
            </div>

            <div className="home-notice-item">
              <span className="home-notice-item-icon" aria-hidden="true"><Smartphone className="home-notice-phone" size={20} /></span>
              <span><strong>Desde el celular</strong>Te recomendamos navegar con la pantalla en modo horizontal.</span>
            </div>

            <a
              className="home-notice-item home-notice-contact"
              href="mailto:atlashistolabfcm@gmail.com?subject=Reporte%20de%20error%20-%20Atlas%20de%20Histolog%C3%ADa"
              aria-label="Reportar un error a atlashistolabfcm@gmail.com"
            >
              <span className="home-notice-item-icon" aria-hidden="true"><Mail size={20} /></span>
              <span><strong>¿Encontraste un error?</strong>Escríbenos a atlashistolabfcm@gmail.com</span>
              <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Home;



