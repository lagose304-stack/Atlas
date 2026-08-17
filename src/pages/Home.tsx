import React, { useEffect, useMemo, useState } from 'react';
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

  const weeklyPublication = useMemo(() => {
    return contentBlocks
      .filter(block => block.block_type === 'weekly_publication')
      .slice(0, 1);
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
          {/* Elementos decorativos de fondo */}
          <span className="home-fact-shine" aria-hidden="true" />
          <span className="home-fact-glow home-fact-glow-cyan" aria-hidden="true" />
          <span className="home-fact-glow home-fact-glow-violet" aria-hidden="true" />
          <span className="home-fact-orbit home-fact-orbit-one" aria-hidden="true" />
          <span className="home-fact-orbit home-fact-orbit-two" aria-hidden="true" />
          <span className="home-histology-fact-mesh" aria-hidden="true" />
          <span className="home-fact-crosshair home-fact-crosshair-tl" aria-hidden="true" />
          <span className="home-fact-crosshair home-fact-crosshair-br" aria-hidden="true" />

          <div className="home-histology-fact-header">
            <div className="home-histology-fact-brand">
              <div className="home-histology-fact-icon" aria-hidden="true">
                <Microscope size={20} />
              </div>
              <span className="home-histology-fact-label">
                <Sparkles size={15} /> Dato histológico de la semana
              </span>
            </div>

            <div className="home-histology-fact-badges">
              <span className="home-histology-fact-chip">Glándulas</span>
            </div>
          </div>

          <div className="home-histology-fact-body">
            <div className="home-histology-fact-copy">
              <div className="home-histology-fact-quote-card">
                <p id="home-histology-fact-title">
                  Las <strong>células de Leydig</strong> del testículo se consideran glándulas endocrinas en acúmulos. Estos pequeños agrupamientos celulares en el tejido intersticial funcionan como estructuras glandulares que secretan <strong>testosterona</strong> directamente en el torrente sanguíneo, sin conductos de excreción.
                </p>
                <div className="home-histology-fact-pills" aria-hidden="true">
                  <span>🧬 Secreción endocrina</span>
                  <span>🩸 Hacia capilares</span>
                </div>
              </div>
            </div>

            <div className="home-histology-tissue-wrapper">
              <svg className="home-histology-tissue" viewBox="0 0 640 230" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Esquema de células de Leydig en el intersticio testicular">
                <title>Esquema simplificado de las células de Leydig en el intersticio testicular</title>
                <desc>Dos túbulos seminíferos con un acúmulo de células de Leydig entre ellos, que secretan testosterona directamente hacia un vaso sanguíneo cercano.</desc>
                <defs>
                  <marker id="fact-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                    <path d="M2 1L8 5L2 9" fill="none" stroke="#0284c7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </marker>
                  <radialGradient id="tubuleGrad" cx="50%" cy="40%" r="60%">
                    <stop offset="0%" stopColor="#f0f9ff" />
                    <stop offset="100%" stopColor="#e0f2fe" />
                  </radialGradient>
                  <filter id="labelShadow" x="-10%" y="-15%" width="120%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="#0c4568" floodOpacity="0.08" />
                  </filter>
                </defs>

                {/* Retículas de enfoque microscópico */}
                <path d="M 12 18 L 12 12 L 18 12" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 628 18 L 628 12 L 622 12" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 12 212 L 12 218 L 18 218" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
                <path d="M 628 212 L 628 218 L 622 218" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />

                {/* Túbulos seminíferos con membrana basal */}
                <circle cx="150" cy="115" r="77" fill="none" stroke="#bae6fd" strokeWidth="1" strokeDasharray="3,3"/>
                <circle cx="150" cy="115" r="72" fill="url(#tubuleGrad)" stroke="#38bdf8" strokeWidth="1.4"/>
                <circle cx="490" cy="115" r="77" fill="none" stroke="#bae6fd" strokeWidth="1" strokeDasharray="3,3"/>
                <circle cx="490" cy="115" r="72" fill="url(#tubuleGrad)" stroke="#38bdf8" strokeWidth="1.4"/>

                <text x="150" y="108" textAnchor="middle" fontFamily="'Montserrat', sans-serif" fontSize="15" fontWeight="750" fill="#0369a1">Túbulo</text>
                <text x="150" y="128" textAnchor="middle" fontFamily="'Montserrat', sans-serif" fontSize="13.5" fontWeight="600" fill="#0284c7">seminífero</text>
                <text x="490" y="108" textAnchor="middle" fontFamily="'Montserrat', sans-serif" fontSize="15" fontWeight="750" fill="#0369a1">Túbulo</text>
                <text x="490" y="128" textAnchor="middle" fontFamily="'Montserrat', sans-serif" fontSize="13.5" fontWeight="600" fill="#0284c7">seminífero</text>

                {/* Vaso sanguíneo (Capilar) */}
                <path d="M 80 178 Q 320 156, 560 178" fill="none" stroke="#ef4444" strokeWidth="4.5" strokeLinecap="round"/>
                <circle cx="210" cy="172" r="3" fill="#fca5a5" />
                <circle cx="280" cy="166" r="3" fill="#fca5a5" />
                <circle cx="360" cy="166" r="3" fill="#fca5a5" />
                <circle cx="430" cy="172" r="3" fill="#fca5a5" />

                {/* Células de Leydig con núcleo visible */}
                <circle cx="300" cy="108" r="12.5" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.3"/>
                <circle cx="300" cy="108" r="4" fill="#a78bfa"/>
                <circle cx="338" cy="108" r="12.5" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.3"/>
                <circle cx="338" cy="108" r="4" fill="#a78bfa"/>
                <circle cx="319" cy="128" r="12.5" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.3"/>
                <circle cx="319" cy="128" r="4" fill="#a78bfa"/>
                <circle cx="292" cy="130" r="11" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.3"/>
                <circle cx="292" cy="130" r="3.5" fill="#a78bfa"/>
                <circle cx="346" cy="130" r="11" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="1.3"/>
                <circle cx="346" cy="130" r="3.5" fill="#a78bfa"/>

                {/* Flecha de secreción hacia el vaso */}
                <line x1="319" y1="143" x2="319" y2="160" stroke="#0284c7" strokeWidth="1.8" markerEnd="url(#fact-arrow)"/>
                <rect x="330" y="142" width="94" height="19" rx="4" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="0.8" filter="url(#labelShadow)"/>
                <text x="377" y="156" textAnchor="middle" fontFamily="'Montserrat', sans-serif" fontSize="11" fontWeight="800" fill="#0284c7">Testosterona</text>

                {/* Etiqueta superior Células de Leydig */}
                <line x1="319" y1="94" x2="319" y2="42" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2"/>
                <circle cx="319" cy="94" r="3" fill="#8b5cf6"/>
                <rect x="224" y="14" width="190" height="28" rx="7" fill="#f5f3ff" stroke="#c7d2fe" strokeWidth="1.3" filter="url(#labelShadow)"/>
                <text x="319" y="33" textAnchor="middle" fontFamily="'Montserrat', sans-serif" fontSize="13.5" fontWeight="750" fill="#5b21b6">Células de Leydig</text>

                {/* Etiqueta inferior Vaso sanguíneo */}
                <line x1="319" y1="168" x2="319" y2="190" stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2"/>
                <circle cx="319" cy="168" r="3" fill="#ef4444"/>
                <rect x="234" y="190" width="170" height="28" rx="7" fill="#fef2f2" stroke="#fecaca" strokeWidth="1.3" filter="url(#labelShadow)"/>
                <text x="319" y="209" textAnchor="middle" fontFamily="'Montserrat', sans-serif" fontSize="13.5" fontWeight="750" fill="#991b1b">Vaso sanguíneo</text>
              </svg>
            </div>
          </div>
        </section>

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



