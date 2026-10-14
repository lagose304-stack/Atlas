import React, { useEffect, useRef, useState } from 'react';
import { Microscope, Play, Pause } from 'lucide-react';
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

export interface AdrenomedullaryHistologyFactProps {
  badgeLabel?: string;
  className?: string;
}

export const AdrenomedullaryHistologyFact: React.FC<AdrenomedullaryHistologyFactProps> = ({
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

    for (let k = 0; k < 12; k++) {
      const a = k * 0.52 + 0.2;
      const r = 75;
      const x = CX_B + r * Math.cos(a);
      const y = CY + r * Math.sin(a);
      const dx = -Math.sin(a) * 8;
      const dy = Math.cos(a) * 8;
      el('path', { d: `M${(x - dx).toFixed(1)} ${(y - dy).toFixed(1)}L${(x + dx).toFixed(1)} ${(y + dy).toFixed(1)}` }, gCt);
    }

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
          o: Math.random() * 6.28,
        });
      }
    }

    makeRbc(18, gRa, raList);
    makeRbc(18, gRb, rbList);

    let t = 0;
    let clk = 0;
    let play = true;
    let last = 0;
    let cur = -1;
    let drag = false;
    let rafId: number | null = null;

    const op: [number, number, number, number, number][] = [
      [1, 0.45, 0, 0, 0],
      [0.6, 1, 1, 0, 0],
      [0.4, 1, 0, 1, 0],
      [0.3, 1, 0, 0, 1],
    ];

    function draw() {
      const st = Math.min(3, Math.floor(t / STEP));
      const fr = (t - st * STEP) / STEP;

      if (st !== cur) {
        cur = st;
        if (dtEl) dtEl.textContent = STAGES[st].title;
        if (dpEl) dpEl.textContent = STAGES[st].desc;

        tabBtns.forEach((b, i) => {
          b.classList.toggle('on', i === st);
        });

        if (gA) gA.style.opacity = String(op[st][0]);
        if (gB) gB.style.opacity = String(op[st][1]);
        if (gX) gX.style.opacity = String(op[st][2]);
        if (gH) gH.style.opacity = String(op[st][3]);
        if (gF) gF.style.opacity = String(op[st][4]);
      }

      tabBtns.forEach((b, i) => {
        const bar = b.querySelector('i');
        if (bar) {
          bar.style.width = (i < st ? 100 : i > st ? 0 : fr * 100) + '%';
        }
      });

      if (!drag && slider) {
        slider.value = String((t / T_TOTAL) * 1000);
      }
    }

    function anim() {
      const st = Math.min(3, Math.floor(t / STEP));
      const fr = (t - st * STEP) / STEP;

      let c_val = 0;
      if (st === 3) {
        c_val = 0.5 + 0.5 * Math.sin(fr * Math.PI * 2 - Math.PI / 2);
      }

      const rb_rad = RL_B_BASE - c_val * 16;
      if (bl) bl.setAttribute('r', rb_rad.toFixed(1));
      if (be) be.setAttribute('r', rb_rad.toFixed(1));

      for (let k = 0; k < 7; k++) {
        const a = k * 0.9 + 0.3;
        const r = 58 - c_val * 10;
        const x = CX_B + r * Math.cos(a);
        const y = CY + r * Math.sin(a);
        const s = 1 + c_val * 0.28;
        bundles[k].setAttribute(
          'transform',
          `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${s.toFixed(2)})`
        );
      }

      const flowScaleB = 1 - c_val * 0.65;
      const rbcScaleB = 1 - c_val * 0.2;

      function updateRbc(list: RbcItem[], cx: number, rMax: number, flowMul: number, scaleMul: number) {
        list.forEach((item) => {
          item.p = (item.p + 0.0035 * item.v * flowMul) % 1;
          const rPos = item.q * rMax;
          const ang = item.a + clk * 0.1;
          const x = cx + rPos * Math.cos(ang);
          const y = CY + rPos * Math.sin(ang);
          const s = (0.45 + item.p * 0.85) * scaleMul;
          const opac = item.p < 0.15 ? item.p / 0.15 : item.p > 0.85 ? (1 - item.p) / 0.15 : 1;
          item.e.setAttribute(
            'transform',
            `translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${s.toFixed(2)}) rotate(${((item.o + clk * 30) % 360).toFixed(0)})`
          );
          item.e.setAttribute('opacity', (opac * 0.95).toFixed(2));
        });
      }

      updateRbc(raList, CX_A, RL_A - 8, 1, 1);
      updateRbc(rbList, CX_B, Math.max(16, rb_rad - 8), flowScaleB, rbcScaleB);
    }

    function loop(ts: number) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      clk += dt;

      if (play && !drag) {
        t += dt * 1000;
        if (t >= T_TOTAL) t = 0;
      }

      draw();
      anim();
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame((ts) => {
      last = ts;
      loop(ts);
    });

    const handlePlayClick = () => {
      play = !play;
      setIsPlaying(play);
    };

    const handleSliderInput = () => {
      if (!slider) return;
      t = (Number(slider.value) / 1000) * T_TOTAL;
      drag = true;
      draw();
      anim();
    };

    const handleSliderChange = () => {
      drag = false;
    };

    const handleTabClick = (idx: number) => {
      t = idx * STEP;
      draw();
      anim();
    };

    if (playBtn) playBtn.addEventListener('click', handlePlayClick);
    if (slider) {
      slider.addEventListener('input', handleSliderInput);
      slider.addEventListener('change', handleSliderChange);
    }

    tabBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => handleTabClick(idx));
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (playBtn) playBtn.removeEventListener('click', handlePlayClick);
      if (slider) {
        slider.removeEventListener('input', handleSliderInput);
        slider.removeEventListener('change', handleSliderChange);
      }
    };
  }, []);

  return (
    <section
      ref={rootRef}
      className={`home-histology-fact adrenomedullary-fact ${className}`}
      aria-label="Dato histológico de la semana: Vena adrenomedular"
    >
      <span className="adreno-fact-shine" aria-hidden="true" />
      <span className="adreno-fact-glow adreno-fact-glow-cyan" aria-hidden="true" />
      <span className="adreno-fact-glow adreno-fact-glow-violet" aria-hidden="true" />
      <span className="home-histology-fact-mesh" aria-hidden="true" />

      <div className="adreno-grid">
        <div className="adreno-left">
          <div className="adreno-top-bar">
            <span className="adreno-badge">
              <Microscope size={13} className="adreno-badge-icon" />
              <span>{badgeLabel.toUpperCase()}</span>
            </span>
          </div>

          <div className="adreno-headings">
            <h3 className="adreno-title">Vena adrenomedular</h3>
            <p className="adreno-subtitle">
              Pared atípica con haces longitudinales de músculo liso en lugar de capa circular continua.
            </p>
          </div>

          <div className="adreno-desc-box">
            <h4 id="dt" className="adreno-desc-title">
              {STAGES[0].title}
            </h4>
            <p id="dp" className="adreno-desc-text">
              {STAGES[0].desc}
            </p>
          </div>

          <div className="adreno-tabs" role="tablist" aria-label="Fases comparativas de la pared vascular">
            {STAGES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                className={`adreno-tab ${i === 0 ? 'on' : ''}`}
                aria-label={`Fase ${i + 1}: ${s.title}`}
              >
                <small>0{i + 1}</small>
                <b>{s.title}</b>
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

        <div className="adreno-fig">
          <svg
            id="adreno-scene"
            viewBox="0 0 740 340"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Comparación de la pared de una vena típica y de la vena adrenomedular"
          >
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

              <circle cx="145" cy="147" r="2.5" fill="#ca8a04" />
              <path className="l" d="M68 118 H 92 L 145 147" />
              <text x="62" y="116" textAnchor="end" className="b" style={{ fontSize: '11.5px', fill: '#0f2a43' }}>
                Endotelio
              </text>
              <text x="62" y="128" textAnchor="end" style={{ fontSize: '9.5px', fill: '#64748b' }}>
                (capa íntima)
              </text>

              <circle cx="136" cy="214" r="2.5" fill="var(--bun)" />
              <path className="l" d="M72 250 H 95 L 136 214" />
              <text x="66" y="248" textAnchor="end" className="b" style={{ fontSize: '11px', fill: 'var(--bun)' }}>
                Capa circular
              </text>
              <text x="66" y="260" textAnchor="end" style={{ fontSize: '9.5px', fill: '#64748b' }}>
                músculo liso continuo
              </text>
            </g>

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

              <circle cx="546" cy="134" r="2.5" fill="var(--bun)" />
              <path className="l" d="M546 134 L 595 90 H 612" />
              <text x="618" y="88" textAnchor="start" className="b" style={{ fontSize: '11.5px', fill: 'var(--bun)' }}>
                Haces longitudinales
              </text>
              <text x="618" y="100" textAnchor="start" style={{ fontSize: '9.5px', fill: '#64748b' }}>
                (fibras cortadas de punta)
              </text>

              <circle cx="533" cy="190" r="2.5" fill="#ca8a04" />
              <path className="l" d="M533 190 L 595 220 H 612" />
              <text x="618" y="218" textAnchor="start" className="b" style={{ fontSize: '11.5px', fill: '#0f2a43' }}>
                Endotelio
              </text>
              <text x="618" y="230" textAnchor="start" style={{ fontSize: '9.5px', fill: '#64748b' }}>
                (revestimiento interno)
              </text>
            </g>

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

export default AdrenomedullaryHistologyFact;
