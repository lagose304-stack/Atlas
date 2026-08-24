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
import InteractiveCalciumBoneSimulator from '../components/InteractiveCalciumBoneSimulator';
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
              <span className="home-histology-fact-chip">Tejido Óseo</span>
            </div>
          </div>

          <div className="home-histology-fact-body home-fact-wrap-body">
            {/* 1. SECCIÓN SUPERIOR: Texto introductorio a un lado + Diagrama al otro lado */}
            <div className="home-fact-top-row">
              <div className="home-fact-intro-side">
                <div className="home-fact-quote-card home-fact-intro-card">
                  <p id="home-histology-fact-title">
                    El <strong>tejido óseo</strong> funciona como el gran <strong>reservorio de calcio del cuerpo (alberga el 99%)</strong>. El equilibrio de la calcemia en sangre depende de la acción coordinada de sus <strong>tres células protagonistas</strong>, reguladas por el <strong>eje hormonal</strong>:
                  </p>

                  <div className="home-fact-hormone-pills">
                    <div className="home-fact-hormone-item hormone-pth">
                      <span className="hormone-title">⚡ PTH (Paratiroides)</span>
                      <span className="hormone-desc">Se libera ante calcio bajo para estimular a los osteoblastos a expresar RANKL y activar la resorción ósea.</span>
                    </div>
                    <div className="home-fact-hormone-item hormone-calcitonin">
                      <span className="hormone-title">🛡️ Calcitonina (Tiroides)</span>
                      <span className="hormone-desc">Se libera ante calcio alto para inhibir directamente a los osteoclastos y favorecer el depósito óseo.</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="home-histology-tissue-wrapper home-fact-diagram-side">
                <InteractiveCalciumBoneSimulator />
              </div>
            </div>

            {/* 2. SECCIÓN INFERIOR: Las 3 tarjetas de células van ABAJO del diagrama ocupando todo el ancho */}
            <div className="home-fact-bottom-row">
              <div className="home-fact-steps home-fact-steps-horizontal" aria-label="Las tres células protagonistas en la regulación del calcio">
                {/* Célula 1: Osteoclastos */}
                <div className="home-fact-step-item home-fact-step-pth">
                  <div className="home-fact-step-header">
                    <span className="home-fact-step-title">🟣 1. Osteoclastos · Liberación (Resorción)</span>
                    <span className="home-fact-step-badge">Sacan Ca²⁺ a la sangre</span>
                  </div>
                  <p className="home-fact-step-text">
                    Células gigantes multinucleadas estimuladas por la <strong>PTH</strong> vía <strong>RANKL</strong> y frenadas directamente por la <strong>Calcitonina</strong>. En la <em>laguna de Howship</em>, disuelven la matriz ósea con ácido (H⁺) y <em>catepsina K</em> para <strong>liberar calcio a la circulación</strong>.
                  </p>
                </div>

                {/* Célula 2: Osteoblastos */}
                <div className="home-fact-step-item home-fact-step-calcitonin">
                  <div className="home-fact-step-header">
                    <span className="home-fact-step-title">🟢 2. Osteoblastos · Depósito (Formación)</span>
                    <span className="home-fact-step-badge">Guardan Ca²⁺ en el hueso</span>
                  </div>
                  <p className="home-fact-step-text">
                    Sintetizan la matriz orgánica (<em>osteoide</em>) y mediante la enzima <em>fosfatasa alcalina</em> <strong>mineralizan y fijan calcio</strong> en el hueso, respondiendo a las demandas hormonales del organismo.
                  </p>
                </div>

                {/* Célula 3: Osteocitos */}
                <div className="home-fact-step-item home-fact-step-osteocyte">
                  <div className="home-fact-step-header">
                    <span className="home-fact-step-title">🔵 3. Osteocitos · Mantenimiento y Nutrición</span>
                    <span className="home-fact-step-badge">Mantenimiento de matriz</span>
                  </div>
                  <p className="home-fact-step-text">
                    Osteoblastos maduros alojados en <em>osteoplastos</em>. Con su red 3D de <em>canalículos</em> se encargan del <strong>mantenimiento y la nutrición de la matriz ósea</strong>, detectando fuerzas mecánicas e intercambiando iones con los fluidos corporales.
                  </p>
                </div>
              </div>

              <div className="home-histology-fact-pills" aria-hidden="true">
                <span>🩸 Control hormonal: PTH (estimula salida) vs Calcitonina (favorece depósito)</span>
                <span>🟣 Osteoclastos: Resorción ósea</span>
                <span>🟢 Osteoblastos: Formación y mineralización</span>
                <span>🔵 Osteocitos: Red canalicular de intercambio</span>
              </div>
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



