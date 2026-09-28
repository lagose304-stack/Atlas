import React, { useEffect, useRef, useState } from 'react';
import { Microscope, Play, Pause, Sparkles } from 'lucide-react';
import '../styles/homeHistologyFact.css';

const NS = 'http://www.w3.org/2000/svg';

function el(tag: string, attrs: Record<string, string | number>, parent?: Element | null): SVGElement {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) {
    e.setAttribute(k, String(attrs[k]));
  }
  if (parent) {
    parent.appendChild(e);
  }
  return e;
}

const STAGES = [
  {
    title: 'Vena típica',
    desc: 'En la mayoría de las venas el músculo liso forma una capa circular que rodea la luz. Es la referencia para ver qué cambia.',
  },
  {
    title: 'Vena adrenomedular',
    desc: 'Aquí no hay capa circular. La media es irregular, con haces musculares y tejido conectivo fibroso; no hay lámina elástica bien definida y la pared se engrosa de forma asimétrica.',
  },
  {
    title: 'Haces longitudinales',
    desc: 'El músculo corre a lo largo del vaso, por eso en un corte transversal cada haz se ve como un grupo de puntos (fibras cortadas de punta). Los haces sobresalen hacia la luz como almohadillas.',
  },
  {
    title: 'Función reguladora (hipótesis)',
    desc: 'Se cree que al contraerse, los haces acortan la vena o protruyen hacia la luz y estrechan el paso. Así modificarían el flujo de salida y la liberación de catecolaminas durante el estrés.',
  },
];

const T_TOTAL = 20000;
const STEP = 5000;

interface RbcItem {
  e: SVGElement;
  p: number;
  v: number;
  a: number;
  q: number;
  o: number;
}

export interface HomeHistologyFactProps {
  badgeLabel?: string;
  className?: string;
}

export const HomeHistologyFact: React.FC<HomeHistologyFactProps> = ({
  badgeLabel = 'Dato histológico de la semana',
  className = '',
}) => {
  const rootRef = useRef<HTMLElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const gCt = root.querySelector('#ct');
    const gBn = root.querySelector('#bn');
    const gRa = root.querySelector('#ra');
    const gRb = root.querySelector('#rb');
    const gA = root.querySelector('#gA') as SVGGElement | null;
    const gB = root.querySelector('#gB') as SVGGElement | null;
    const gX = root.querySelector('#gX') as SVGGElement | null;
    const gH = root.querySelector('#gH') as SVGGElement | null;
    const gF = root.querySelector('#gF') as SVGGElement | null;
    const bl = root.querySelector('#bl') as SVGCircleElement | null;
    const be = root.querySelector('#be') as SVGCircleElement | null;
    const dtEl = root.querySelector('#dt');
    const dpEl = root.querySelector('#dp');
    const playBtn = root.querySelector('#pb') as HTMLButtonElement | null;
    const slider = root.querySelector('#sl') as HTMLInputElement | null;
    const tabBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.adreno-tab'));
    const svgScene = root.querySelector('#adreno-scene') as SVGSVGElement | null;

    if (!gCt || !gBn || !gRa || !gRb || !gA || !gB || !gX || !gH || !gF || !bl || !be) {
      return;
    }

    const CX_A = 190;
    const CX_B = 490;
    const CY = 175;
    const RL_A = 54;
    const RL_B_BASE = 54;

    gCt.innerHTML = '';
    gBn.innerHTML = '';
    gRa.innerHTML = '';
    gRb.innerHTML = '';

    // Generar fibras de tejido conectivo en la media
    for (let k = 0; k < 12; k++) {
      const a = k * 0.52 + 0.2;
      const r = 75;
      const x = CX_B + r * Math.cos(a);
      const y = CY + r * Math.sin(a);
      const dx = -Math.sin(a) * 8;
      const dy = Math.cos(a) * 8;
      el('path', { d: `M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)}L${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}` }, gCt);
    }

    // Generar los 7 haces musculares longitudinales (con corte transversal de fibras)
    const bundles: SVGElement[] = [];
    const DOT_OFFSETS: [number, number][] = [
      [-6, -5],
      [5, -6],
      [-1, 0],
      [7, 4],
      [-6, 7],
      [2, 9],
    ];

    for (let k = 0; k < 7; k++) {
      const g = el('g', {}, gBn);
      el('circle', { r: 15, fill: 'var(--bun)' }, g);
      DOT_OFFSETS.forEach(([dx, dy]) => {
        el('circle', { cx: dx, cy: dy, r: 2.2, fill: 'var(--dot)' }, g);
      });
      bundles.push(g);
    }

    // Inicializar eritrocitos en 3D saliendo hacia el observador
    const raList: RbcItem[] = [];
    const rbList: RbcItem[] = [];

    function makeRbc(count: number, parent: Element, list: RbcItem[]) {
      for (let i = 0; i < count; i++) {
        list.push({
          e: el(
            'ellipse',
            {
              rx: 6.5,
              ry: 4.2,
              fill: '#d9556b',
              stroke: '#a83a4f',
              'stroke-width': 0.8,
            },
            parent
          ),
          p: i / count,
          v: 0.85 + Math.random() * 0.3,
          a: Math.random() * 6.28,
          q: 0.2 + Math.random() * 0.7,
          o: Math.random() * 3,
        });
      }
    }

    makeRbc(9, gRa, raList);
    makeRbc(9, gRb, rbList);

    function updateRbcPositions(list: RbcItem[], cx: number, rl: number, dt: number, speed: number) {
      list.forEach((c) => {
        c.p += dt * speed * c.v;
        if (c.p >= 1) {
          c.p -= 1;
          c.a = Math.random() * 6.28;
          c.q = 0.2 + Math.random() * 0.7;
        }
        const f = 0.35 + 0.65 * c.p;
        const d = rl * 0.85 * c.q * f;
        const sc = 0.35 + 0.95 * c.p;
        const tx = cx + d * Math.cos(c.a);
        const ty = CY + d * Math.sin(c.a);
        const rot = c.o * 60 + c.p * 40;
        c.e.setAttribute('transform', `translate(${tx.toFixed(1)},${ty.toFixed(1)}) rotate(${rot.toFixed(1)}) scale(${sc.toFixed(2)})`);
        c.e.setAttribute('opacity', (Math.sin(Math.PI * c.p) * 0.95).toFixed(2));
      });
    }

    let rlB = RL_B_BASE;
    function flow(dt: number, ccVal: number) {
      updateRbcPositions(raList, CX_A, RL_A, dt, 0.4);
      updateRbcPositions(rbList, CX_B, rlB, dt, 0.4 * (1 - 0.6 * ccVal));
    }

    const OPACITIES: [number, number, number, number, number][] = [
      [1, 0.3, 0, 0, 0], // Fase 1: Vena típica
      [0.3, 1, 1, 0, 0], // Fase 2: Vena adrenomedular (gX)
      [0.25, 1, 0, 1, 0], // Fase 3: Haces longitudinales (gH)
      [0.25, 1, 0, 0, 1], // Fase 4: Función reguladora (gF)
    ];

    let t = 0;
    let clk = 0;
    let cc = 0;
    let play = true;
    let last = performance.now();
    let cur = -1;
    let isDragging = false;
    let isVisible = true;
    let animId = 0;

    function draw() {
      const st = Math.min(3, Math.floor(t / STEP));
      const fr = (t - st * STEP) / STEP;

      if (st !== cur) {
        cur = st;
        if (dtEl) dtEl.textContent = STAGES[st].title;
        if (dpEl) dpEl.textContent = STAGES[st].desc;

        tabBtns.forEach((b, i) => {
          b.classList.toggle('on', i === st);
          b.setAttribute('aria-selected', i === st ? 'true' : 'false');
        });

        const op = OPACITIES[st];
        gA!.style.opacity = String(op[0]);
        gB!.style.opacity = String(op[1]);
        gX!.style.opacity = String(op[2]);
        gH!.style.opacity = String(op[3]);
        gF!.style.opacity = String(op[4]);
      }

      tabBtns.forEach((b, i) => {
        const bar = b.querySelector('i');
        if (bar) {
          const widthPct = i < st ? 100 : i > st ? 0 : fr * 100;
          bar.style.width = `${widthPct.toFixed(1)}%`;
        }
      });

      if (!isDragging && slider) {
        slider.value = String(Math.round((t / T_TOTAL) * 1000));
      }

      const rl = RL_B_BASE - 11 * cc;
      rlB = rl;
      bl!.setAttribute('r', rl.toFixed(1));
      be!.setAttribute('r', rl.toFixed(1));

      bundles.forEach((b, i) => {
        const a = (i * 2 * Math.PI) / 7 - Math.PI / 2;
        const r = rl + 11;
        const bx = CX_B + r * Math.cos(a);
        const by = CY + r * Math.sin(a);
        const sc = (1 + 0.22 * cc).toFixed(2);
        b.setAttribute('transform', `translate(${bx.toFixed(1)},${by.toFixed(1)}) scale(${sc})`);
      });
    }

    function loop(ts: number) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      clk += dt;

      if (play && !isDragging && isVisible) {
        t += dt * 1000;
        if (t >= T_TOTAL) t = 0;
      }

      const tg = cur === 3 ? 0.5 + 0.5 * Math.sin(clk * 2.5) : 0;
      cc += (tg - cc) * Math.min(1, dt * 6);

      if (isVisible) {
        draw();
        flow(dt, cc);
      }

      animId = requestAnimationFrame(loop);
    }

    const onPlayToggle = () => {
      play = !play;
      setIsPlaying(play);
      if (playBtn) {
        playBtn.setAttribute('aria-label', play ? 'Pausar animación' : 'Reanudar animación');
      }
    };

    const onSliderInput = () => {
      if (!slider) return;
      t = (Number(slider.value) / 1000) * T_TOTAL;
      isDragging = true;
      draw();
    };

    const onSliderChange = () => {
      isDragging = false;
    };

    const tabListeners: { btn: HTMLButtonElement; handler: () => void }[] = [];
    tabBtns.forEach((b, i) => {
      const handler = () => {
        t = i * STEP;
        draw();
      };
      b.addEventListener('click', handler);
      tabListeners.push({ btn: b, handler });
    });

    playBtn?.addEventListener('click', onPlayToggle);
    slider?.addEventListener('input', onSliderInput);
    slider?.addEventListener('change', onSliderChange);

    let observer: IntersectionObserver | null = null;
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window && svgScene) {
      observer = new IntersectionObserver(
        (entries) => {
          isVisible = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0.05 }
      );
      observer.observe(svgScene);
    }

    draw();
    animId = requestAnimationFrame((ts) => {
      last = ts;
      loop(ts);
    });

    return () => {
      cancelAnimationFrame(animId);
      observer?.disconnect();
      playBtn?.removeEventListener('click', onPlayToggle);
      slider?.removeEventListener('input', onSliderInput);
      slider?.removeEventListener('change', onSliderChange);
      tabListeners.forEach(({ btn, handler }) => {
        btn.removeEventListener('click', handler);
      });
    };
  }, []);

  return (
    <section
      className={`home-histology-fact home-reveal adrenomedullary-fact ${className}`.trim()}
      id="vena-adrenomedular"
      aria-labelledby="adreno-title"
      ref={rootRef}
    >
      <span className="home-fact-shine" aria-hidden="true" />
      <span className="home-fact-glow home-fact-glow-cyan" aria-hidden="true" />
      <span className="home-fact-glow home-fact-glow-violet" aria-hidden="true" />
      <span className="home-histology-fact-mesh" aria-hidden="true" />

      <div className="adreno-grid">
        {/* ─── Columna Izquierda: Información, Fases y Controles ─── */}
        <div className="adreno-left">
          <div className="adreno-top">
            <span className="adreno-ico" aria-hidden="true">
              <Microscope size={18} />
            </span>
            <span className="adreno-badge">
              <Sparkles size={13} /> {badgeLabel}
            </span>
          </div>

          <div className="adreno-header">
            <h2 id="adreno-title">Vena adrenomedular</h2>
            <p className="sub">
              Una vena con la pared distinta: su músculo liso no forma una capa circular, sino haces longitudinales.
            </p>
          </div>

          <div className="adreno-desc" aria-live="polite">
            <h3 id="dt">{STAGES[0].title}</h3>
            <p id="dp">{STAGES[0].desc}</p>
          </div>

          <div className="adreno-tabs" role="tablist" aria-label="Fases comparativas">
            {STAGES.map((st, i) => (
              <button
                key={st.title}
                type="button"
                className={`adreno-tab ${i === 0 ? 'on' : ''}`}
                role="tab"
                aria-selected={i === 0 ? 'true' : 'false'}
              >
                <small>Fase {i + 1}</small>
                <b>{st.title}</b>
                <i style={{ width: i === 0 ? '0%' : '0%' }} />
              </button>
            ))}
          </div>

          <div className="adreno-ctl">
            <button
              id="pb"
              type="button"
              aria-label={isPlaying ? 'Pausar animación' : 'Reanudar animación'}
            >
              {isPlaying ? <Pause size={14} /> : <Play size={14} />}
              <span>{isPlaying ? 'Pausar' : 'Reanudar'}</span>
            </button>
            <input
              id="sl"
              type="range"
              min="0"
              max="1000"
              defaultValue="0"
              aria-label="Progreso de la animación comparativa"
            />
          </div>

          <div className="adreno-leg" aria-label="Leyenda de estructuras">
            <span style={{ ['--c' as string]: '#e8c400' }}>Endotelio</span>
            <span style={{ ['--c' as string]: 'var(--bun)' }}>Músculo liso</span>
            <span style={{ ['--c' as string]: '#d9556b' }}>Eritrocitos (flujo hacia el observador)</span>
            <span style={{ ['--c' as string]: 'var(--med)' }}>Media</span>
            <span style={{ ['--c' as string]: 'var(--adv)' }}>Adventicia</span>
          </div>
        </div>

        {/* ─── Columna Derecha: Esquema SVG Dinámico Adaptado ─── */}
        <div className="adreno-fig">
          <svg
            id="adreno-scene"
            viewBox="0 0 740 340"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Comparación de la pared de una vena típica y de la vena adrenomedular"
          >
            {/* Vena Típica */}
            <g id="gA" className="g">
              <text x="190" y="28" textAnchor="middle" className="b" style={{ fontSize: '13px', fill: 'var(--ink)' }}>
                Vena típica
              </text>
              <text x="190" y="44" textAnchor="middle" style={{ fontSize: '11px', fill: 'var(--mute)' }}>
                músculo circular
              </text>
              <circle cx="190" cy="175" r="95" fill="var(--adv)" />
              <circle cx="190" cy="175" r="80" fill="var(--med)" />
              <circle
                cx="190"
                cy="175"
                r="67"
                fill="none"
                stroke="var(--bun)"
                strokeWidth="12"
                strokeDasharray="10 3"
              />
              <circle cx="190" cy="175" r="54" fill="var(--lum)" />
              <circle cx="190" cy="175" r="54" fill="none" stroke="#eab308" strokeWidth="2.8" />
              <g id="ra" />
              <text x="190" y="179" textAnchor="middle" style={{ opacity: 0.65, fontSize: '12px', fontWeight: 600 }}>
                Luz
              </text>

              {/* Puntero Endotelio (texto alineado a la izquierda, línea hacia la derecha sin solapar texto) */}
              <circle cx="145" cy="147" r="2.5" fill="#ca8a04" />
              <path className="l" d="M68 118 H 92 L 145 147" />
              <text x="62" y="116" textAnchor="end" className="b" style={{ fontSize: '11.5px', fill: '#0f2a43' }}>
                Endotelio
              </text>
              <text x="62" y="128" textAnchor="end" style={{ fontSize: '9.5px', fill: '#64748b' }}>
                (capa íntima)
              </text>

              {/* Puntero Capa Circular (texto alineado a la izquierda, línea hacia la derecha sin solapar texto) */}
              <circle cx="136" cy="214" r="2.5" fill="var(--bun)" />
              <path className="l" d="M72 250 H 95 L 136 214" />
              <text x="66" y="248" textAnchor="end" className="b" style={{ fontSize: '11px', fill: 'var(--bun)' }}>
                Capa circular
              </text>
              <text x="66" y="260" textAnchor="end" style={{ fontSize: '9.5px', fill: '#64748b' }}>
                músculo liso continuo
              </text>
            </g>

            {/* Vena Adrenomedular */}
            <g id="gB" className="g">
              <text x="490" y="28" textAnchor="middle" className="b" style={{ fontSize: '13px', fill: 'var(--ink)' }}>
                Vena adrenomedular
              </text>
              <text x="490" y="44" textAnchor="middle" style={{ fontSize: '11px', fill: 'var(--mute)' }}>
                haces longitudinales
              </text>
              <circle cx="490" cy="175" r="95" fill="var(--adv)" />
              <circle cx="490" cy="175" r="80" fill="var(--med)" />
              <g id="ct" stroke="var(--dot)" strokeWidth="1.8" strokeLinecap="round" />
              <circle id="bl" cx="490" cy="175" fill="var(--lum)" />
              <circle id="be" cx="490" cy="175" fill="none" stroke="#eab308" strokeWidth="2.8" />
              <g id="rb" />
              <g id="bn" />
              <text x="490" y="179" textAnchor="middle" style={{ opacity: 0.65, fontSize: '12px', fontWeight: 600 }}>
                Luz
              </text>

              {/* Puntero Haces Longitudinales (hacia la derecha con textAnchor start) */}
              <circle cx="546" cy="134" r="2.5" fill="var(--bun)" />
              <path className="l" d="M546 134 L 595 90 H 612" />
              <text x="618" y="88" textAnchor="start" className="b" style={{ fontSize: '11.5px', fill: 'var(--bun)' }}>
                Haces longitudinales
              </text>
              <text x="618" y="100" textAnchor="start" style={{ fontSize: '9.5px', fill: '#64748b' }}>
                (fibras cortadas de punta)
              </text>

              {/* Puntero Endotelio (hacia la derecha con textAnchor start) */}
              <circle cx="533" cy="190" r="2.5" fill="#ca8a04" />
              <path className="l" d="M533 190 L 595 220 H 612" />
              <text x="618" y="218" textAnchor="start" className="b" style={{ fontSize: '11.5px', fill: '#0f2a43' }}>
                Endotelio
              </text>
              <text x="618" y="230" textAnchor="start" style={{ fontSize: '9.5px', fill: '#64748b' }}>
                (revestimiento interno)
              </text>
            </g>

            {/* Marcador de contraste: No hay capa circular (Fase 2) */}
            <g id="gX" className="g" opacity="0">
              <circle
                cx="490"
                cy="175"
                r="67"
                fill="none"
                stroke="#dc2626"
                strokeWidth="1.8"
                strokeDasharray="5 4"
              />
              <g transform="translate(325, 284)">
                <rect width="330" height="32" rx="8" fill="#fef2f2" stroke="#fca5a5" strokeWidth="1.2" />
                <text x="165" y="20" textAnchor="middle" className="b" style={{ fill: '#dc2626', fontSize: '11px' }}>
                  ✕ Sin capa circular de músculo liso continuo
                </text>
              </g>
            </g>

            {/* Marcador de contraste: Haces longitudinales presentes (Fase 3) */}
            <g id="gH" className="g" opacity="0">
              <g transform="translate(325, 282)">
                <rect width="330" height="36" rx="8" fill="#fdf4ff" stroke="#f0abfc" strokeWidth="1.2" />
                <text x="165" y="15" textAnchor="middle" className="b" style={{ fill: '#a21caf', fontSize: '11.5px' }}>
                  ✦ En su lugar: haces longitudinales de músculo liso
                </text>
                <text x="165" y="28" textAnchor="middle" style={{ fill: '#6b21a8', fontSize: '9.5px' }}>
                  Fibras orientadas en el eje largo (se ven cortadas de punta)
                </text>
              </g>
            </g>

            {/* Marcador de contraste: Función reguladora y contracción (Fase 4) */}
            <g id="gF" className="g" opacity="0">
              <g transform="translate(325, 282)">
                <rect width="330" height="36" rx="8" fill="#f0f9ff" stroke="#bae6fd" strokeWidth="1.2" />
                <text x="165" y="15" textAnchor="middle" className="b" style={{ fill: '#0284c7', fontSize: '11.5px' }}>
                  Los haces se contraen y protruyen hacia la luz
                </text>
                <text x="165" y="28" textAnchor="middle" style={{ fill: '#475569', fontSize: '9.5px' }}>
                  → Estrechan la luz y modulan el flujo de catecolaminas
                </text>
              </g>
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
};

export default HomeHistologyFact;
