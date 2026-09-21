import React, { useEffect, useRef } from 'react';
import { Microscope, Sparkles } from 'lucide-react';
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

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function smooth(x: number): number {
  const c = clamp01(x);
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function seg(t: number, a: number, b: number): number {
  return clamp01((t - a) / (b - a));
}

function rng(seedInit: number): () => number {
  let seed = seedInit;
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STAGES = [
  {
    t: 'Rodamiento',
    d: 'El endotelio activado expone selectinas. Se unen al leucocito y se sueltan con rapidez, así que la célula frena y rueda sobre la pared en lugar de ser arrastrada por el flujo.',
  },
  {
    t: 'Adhesión firme',
    d: 'Las quimiocinas del endotelio activan las integrinas del leucocito. Al unirse a ICAM-1, la célula se detiene y se aplana contra la pared.',
  },
  {
    t: 'Diapédesis',
    d: 'El leucocito se deforma y pasa entre dos células endoteliales. Después atraviesa la membrana basal y llega al tejido.',
  },
  {
    t: 'Migración hacia el foco',
    d: 'Ya en el tejido, sigue el gradiente de quimiocinas que libera la zona infectada hasta llegar a los microorganismos.',
  },
];

const W = 900;
const J = 470;
// 50% más rápido que los 17s originales (17 / 1.5 = 11.33s)
const LOOP = 11.33;
const B = [0, 0.24, 0.48, 0.76, 1];
const NECK = 220;
const WIN = 34;
const BX = 830;
const BY = 418;

function sfun(y: number, k: number): number {
  const d = (y - NECK) / WIN;
  return 1 - k * Math.max(0, 1 - d * d);
}

interface LeukState {
  x: number;
  y: number;
  rx: number;
  ry: number;
  phi: number;
  tear: number;
  k: number;
  g: number;
  h: number;
  theta: number;
  opS: number;
  opI: number;
}

function calcState(T: number): LeukState {
  const s: LeukState = {
    x: 170,
    y: 136,
    rx: 30,
    ry: 30,
    phi: 0,
    tear: 0,
    k: 0,
    g: 0,
    h: 8,
    theta: 0,
    opS: 0,
    opI: 0,
  };

  let p: number;
  if (T < B[1]) {
    p = seg(T, B[0], B[1]);
    s.x = 170 + 245 * (1 - Math.pow(1 - p, 1.7));
    s.y = 166 + 2.4 * Math.sin(p * 44) - 30;
    s.opS = 1;
  } else if (T < B[2]) {
    p = seg(T, B[1], B[2]);
    s.x = 415 + 55 * smooth(seg(p, 0, 0.6));
    const f = smooth(seg(p, 0.2, 0.85));
    s.rx = lerp(30, 40, f);
    s.ry = lerp(30, 22, f);
    s.y = lerp(166, 172, f) - s.ry;
    s.opS = 1 - smooth(seg(p, 0.25, 0.75));
    s.opI = smooth(seg(p, 0.3, 0.85));
  } else if (T < B[3]) {
    p = seg(T, B[2], B[3]);
    s.x = J;
    const sq = smooth(seg(p, 0, 0.35));
    const rel = smooth(seg(p, 0.7, 1));
    s.rx = 40 - 12 * sq + 2 * rel;
    s.ry = 22 + 11 * sq - 3 * rel;
    s.y = lerp(150, 268, smooth(p));
    s.k = 0.55 * smooth(seg(p, 0.05, 0.3)) * (1 - smooth(seg(p, 0.72, 0.95)));
    s.g = 16 * smooth(seg(p, 0, 0.3)) * (1 - smooth(seg(p, 0.75, 1)));
    s.h = 8 + 14 * smooth(seg(p, 0.1, 0.4)) * (1 - smooth(seg(p, 0.8, 1)));
    s.opI = 1 - smooth(seg(p, 0, 0.3));
  } else {
    p = seg(T, B[3], B[4]);
    const t = smooth(p);
    const u = 1 - t;
    const P0 = [470, 268];
    const P1 = [520, 392];
    const P2 = [776, 404];
    s.x = u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0];
    s.y = u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1];
    const vx = 2 * u * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
    const vy = 2 * u * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
    s.phi = Math.atan2(vy, vx);
    const pol = smooth(seg(p, 0.05, 0.3));
    const wob = Math.sin(p * 38) * 0.04 * pol;
    s.rx = lerp(30, 38, pol) * (1 + wob);
    s.ry = lerp(30, 23, pol) * (1 - wob);
    s.tear = 0.16 * pol;
  }

  const xr = s.x < 170 ? 170 : s.x > 470 ? 470 : s.x;
  s.theta = (xr - 170) / 30;
  return s;
}

export const HomeHistologyFact: React.FC = () => {
  const rootRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const rand = rng(11);

    const gEndo = root.querySelector('#endo');
    const gMol = root.querySelector('#mol');
    const gBonds = root.querySelector('#bonds');
    const gRbc = root.querySelector('#rbc');
    const gDiff = root.querySelector('#diffuse');
    const gBact = root.querySelector('#bact');
    const gGrans = root.querySelector('#grans');
    const gLobes = root.querySelector('#lobes');
    const body = root.querySelector('#body') as SVGPathElement | null;
    const gLeuk = root.querySelector('#leuk') as SVGGElement | null;
    const bmL = root.querySelector('#bmL') as SVGPathElement | null;
    const bmR = root.querySelector('#bmR') as SVGPathElement | null;
    const halo1 = root.querySelector('#halo1') as SVGCircleElement | null;
    const halo2 = root.querySelector('#halo2') as SVGCircleElement | null;
    const scene = root.querySelector('#scene') as SVGSVGElement | null;

    if (!gEndo || !gMol || !gBonds || !gRbc || !gDiff || !gBact || !gGrans || !gLobes || !body || !gLeuk || !bmL || !bmR || !halo1 || !halo2) {
      return;
    }

    gEndo.innerHTML = '';
    gMol.innerHTML = '';
    gBonds.innerHTML = '';
    gRbc.innerHTML = '';
    gDiff.innerHTML = '';
    gBact.innerHTML = '';
    gGrans.innerHTML = '';
    gLobes.innerHTML = '';

    const junctions = [130, 300, 470, 640, 790];
    function okX(x: number) {
      for (let i = 0; i < junctions.length; i++) {
        const lim = junctions[i] === J ? 26 : 14;
        if (Math.abs(x - junctions[i]) <= lim) return false;
      }
      return true;
    }

    const cells = [
      [-20, 124],
      [136, 294],
      [306, 464],
      [476, 634],
      [646, 784],
      [796, 920],
    ];
    let cellL: SVGRectElement | null = null;
    let cellR: SVGRectElement | null = null;

    cells.forEach((c, i) => {
      const r = el(
        'rect',
        {
          x: c[0],
          y: 199,
          width: c[1] - c[0],
          height: 26,
          rx: 9,
          fill: '#EBA99E',
          stroke: '#C4766B',
          'stroke-width': 1.2,
        },
        gEndo
      ) as SVGRectElement;
      if (i === 2) cellL = r;
      if (i === 3) cellR = r;
    });

    [
      [100, 14],
      [215, 17],
      [385, 17],
      [555, 17],
      [715, 17],
      [858, 17],
    ].forEach((n) => {
      el('ellipse', { cx: n[0], cy: 212, rx: n[1], ry: 6, fill: '#D27F73' }, gEndo);
    });

    interface MolItem {
      x: number;
      type: 's' | 'i';
      head: number;
      bond?: SVGLineElement;
    }

    const mols: MolItem[] = [];
    for (let x = 150; x < 900; x += 34) {
      if (okX(x)) mols.push({ x, type: 's', head: 175 });
    }
    for (let x = 158; x < 900; x += 17) {
      if (okX(x)) mols.push({ x, type: 'i', head: 185 });
    }

    const SEL_STROKE = '#D9981A';
    const ICAM_STROKE = '#12866F';

    mols.forEach((m) => {
      const s = m.type === 's';
      el(
        'line',
        {
          x1: m.x,
          y1: 199,
          x2: m.x,
          y2: m.head,
          stroke: s ? SEL_STROKE : ICAM_STROKE,
          'stroke-width': 1.6,
          'stroke-linecap': 'round',
        },
        gMol
      );
      el(
        'circle',
        {
          cx: m.x,
          cy: m.head,
          r: s ? 3.6 : 3.1,
          fill: s ? '#F0B429' : '#2CB79A',
          stroke: s ? '#B0740D' : '#0D6B58',
          'stroke-width': 0.9,
        },
        gMol
      );
    });

    const surf: SVGCircleElement[] = [];
    for (let x = 163; x < 900; x += 34) {
      if (okX(x)) {
        surf.push(el('circle', { cx: x, cy: 194, r: 2.3, fill: '#A23F9A', opacity: 0 }, gMol) as SVGCircleElement);
      }
    }

    mols.forEach((m) => {
      const s = m.type === 's';
      m.bond = el(
        'line',
        {
          x1: m.x,
          y1: m.head,
          x2: m.x,
          y2: m.head,
          stroke: s ? SEL_STROKE : ICAM_STROKE,
          'stroke-width': s ? 1.7 : 2.4,
          'stroke-linecap': 'round',
          opacity: 0,
        },
        gBonds
      ) as SVGLineElement;
    });

    interface RbcItem {
      g: SVGGElement;
      y: number;
      x0: number;
      v: number;
      rot: number;
    }

    const rbcs: RbcItem[] = [];
    const lanes = [42, 58, 74, 90, 50, 66, 82, 46, 62, 86, 54, 78];
    lanes.forEach((y, i) => {
      const g = el('g', {}, gRbc) as SVGGElement;
      el('ellipse', { rx: 13, ry: 7, fill: '#D8524B' }, g);
      el('ellipse', { rx: 6, ry: 3, fill: '#E9877F' }, g);
      rbcs.push({ g, y, x0: i * 80 + rand() * 30, v: 82 + ((i * 37) % 64), rot: (rand() - 0.5) * 50 });
    });

    interface DiffItem {
      c: SVGCircleElement;
      cos: number;
      sin: number;
      ph: number;
      sp: number;
      wob: number;
    }

    const diff: DiffItem[] = [];
    for (let i = 0; i < 70; i++) {
      const ang = ((195 + rand() * 75) * Math.PI) / 180;
      diff.push({
        c: el('circle', { r: 1.5 + rand() * 1.9, fill: '#A23F9A', opacity: 0 }, gDiff) as SVGCircleElement,
        cos: Math.cos(ang),
        sin: Math.sin(ang),
        ph: rand(),
        sp: 0.55 + rand() * 0.7,
        wob: rand() * 10,
      });
    }

    interface RodItem {
      e: SVGRectElement;
      cx: number;
      cy: number;
      a: number;
    }

    const rods: RodItem[] = [];
    [
      [-16, -8, 20],
      [-6, 10, -30],
      [8, -14, 60],
      [16, 4, 10],
      [-20, 12, 80],
      [0, -1, -60],
      [24, -8, 35],
    ].forEach((r) => {
      const rc = el(
        'rect',
        {
          x: BX + r[0] - 8,
          y: BY + r[1] - 3.5,
          width: 16,
          height: 7,
          rx: 3.5,
          fill: '#A23F9A',
          stroke: '#6E2168',
          'stroke-width': 1,
        },
        gBact
      ) as SVGRectElement;
      rods.push({ e: rc, cx: BX + r[0], cy: BY + r[1], a: r[2] });
    });

    const grans = [
      [-19, 4],
      [-8, -17],
      [8, -15],
      [20, 8],
      [-2, 19],
      [-20, -8],
      [18, -2],
      [10, 17],
    ].map((p) => {
      return { x: p[0], y: p[1], e: el('circle', { r: 1.6, fill: '#7688E6', opacity: 0.85 }, gGrans) as SVGCircleElement };
    });

    const lobes = [
      { x: -11, y: -6, r: 8.5 },
      { x: 3, y: 9, r: 8.5 },
      { x: 13, y: -5, r: 7.5 },
    ].map((l) => {
      return {
        ...l,
        e: el('ellipse', { fill: '#4B5BD0', opacity: 0.93 }, gLobes) as SVGEllipseElement,
      };
    });

    const N = 72;
    const cosA: number[] = [];
    const sinA: number[] = [];
    for (let i = 0; i < N; i++) {
      cosA.push(Math.cos((i / N) * Math.PI * 2));
      sinA.push(Math.sin((i / N) * Math.PI * 2));
    }

    const reduce = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let playing = !reduce;
    let T = reduce ? 0.6 : 0;
    let amb = 0;

    function renderScene() {
      const s = calcState(T);
      const fade = smooth(seg(T, 0, 0.02)) * (1 - smooth(seg(T, 0.97, 1)));
      const cp = Math.cos(s.phi);
      const sp = Math.sin(s.phi);
      let d = '';

      for (let j = 0; j < N; j++) {
        const ca = cosA[j];
        const lx = s.rx * ca;
        const ly = s.ry * sinA[j] * (1 - s.tear * ca);
        let X = s.x + lx * cp - ly * sp;
        const Y = s.y + lx * sp + ly * cp;
        if (s.k > 0) {
          X = J + (X - J) * sfun(Y, s.k);
        }
        d += (j ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1);
      }
      body!.setAttribute('d', d + 'Z');
      gLeuk!.setAttribute('opacity', fade.toFixed(3));

      const ct = Math.cos(s.theta);
      const st = Math.sin(s.theta);
      function local(px: number, py: number): [number, number, number] {
        let u = px * ct - py * st;
        let v = px * st + py * ct;
        u *= s.rx / 30;
        v *= s.ry / 30;
        let wx = s.x + u * cp - v * sp;
        const wy = s.y + u * sp + v * cp;
        let sc = 1;
        if (s.k > 0) {
          sc = sfun(wy, s.k);
          wx = J + (wx - J) * sc;
        }
        return [wx, wy, sc];
      }

      const rs = Math.min(s.rx, s.ry) / 30;
      lobes.forEach((l) => {
        const q = local(l.x, l.y);
        l.e.setAttribute('cx', q[0].toFixed(1));
        l.e.setAttribute('cy', q[1].toFixed(1));
        l.e.setAttribute('rx', (l.r * rs * q[2]).toFixed(1));
        l.e.setAttribute('ry', (l.r * rs).toFixed(1));
      });
      grans.forEach((g) => {
        const q = local(g.x, g.y);
        g.e.setAttribute('cx', q[0].toFixed(1));
        g.e.setAttribute('cy', q[1].toFixed(1));
      });

      if (cellL) cellL.setAttribute('width', String(464 - s.g - 306));
      if (cellR) {
        cellR.setAttribute('x', String(476 + s.g));
        cellR.setAttribute('width', String(634 - (476 + s.g)));
      }
      bmL!.setAttribute('d', 'M-10 234 H' + (J - s.h));
      bmR!.setAttribute('d', 'M' + (J + s.h) + ' 234 H910');

      mols.forEach((m) => {
        const op = m.type === 's' ? s.opS : s.opI;
        let shown = false;
        if (op > 0.01 && s.phi === 0) {
          const dx = m.x - s.x;
          const lim = s.rx * (m.type === 's' ? 0.92 : 0.85);
          if (Math.abs(dx) < lim) {
            const edge = s.y + s.ry * Math.sqrt(1 - (dx / s.rx) * (dx / s.rx));
            if (edge < m.head - 1.5) {
              const prox = smooth((lim - Math.abs(dx)) / 10);
              if (m.bond) {
                m.bond.setAttribute('y2', edge.toFixed(1));
                m.bond.setAttribute('opacity', (op * fade * prox).toFixed(2));
                shown = true;
              }
            }
          }
        }
        if (!shown && m.bond) {
          m.bond.setAttribute('opacity', '0');
        }
      });

      const sd = smooth(seg(T, 0, 0.2)) * (1 - smooth(seg(T, 0.95, 1)));
      surf.forEach((c) => {
        c.setAttribute('opacity', (sd * 0.9).toFixed(2));
      });

      rbcs.forEach((r) => {
        const span = W + 80;
        const xx = ((((r.x0 + r.v * amb) % span) + span) % span) - 40;
        r.g.setAttribute('transform', 'translate(' + xx.toFixed(1) + ' ' + r.y + ') rotate(' + r.rot.toFixed(1) + ')');
      });

      diff.forEach((q) => {
        const pr = (amb * 0.045 * q.sp + q.ph) % 1;
        const dist = pr * 440;
        const wb = Math.sin(amb * 1.3 + q.wob) * 5;
        q.c.setAttribute('cx', (BX + q.cos * dist - q.sin * wb).toFixed(1));
        q.c.setAttribute('cy', (BY + q.sin * dist + q.cos * wb).toFixed(1));
        q.c.setAttribute('opacity', (0.7 * Math.pow(1 - pr, 1.3)).toFixed(2));
      });

      rods.forEach((r, k) => {
        const a = r.a + 6 * Math.sin(amb * 1.5 + k);
        r.e.setAttribute('transform', 'rotate(' + a.toFixed(1) + ' ' + r.cx + ' ' + r.cy + ')');
      });
      const pulse = Math.sin(amb * 1.6);
      halo1!.setAttribute('opacity', (0.09 + 0.03 * pulse).toFixed(3));
      halo2!.setAttribute('opacity', (0.055 + 0.02 * pulse).toFixed(3));
    }

    const playBtn = root.querySelector('#play') as HTMLButtonElement | null;
    const playIcon = root.querySelector('#playIcon');
    const playText = root.querySelector('#playText');
    const seek = root.querySelector('#seek') as HTMLInputElement | null;
    const stepBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('#steps .step'));
    const stepBars = stepBtns.map((b) => b.querySelector<HTMLElement>('.bar'));
    const dTitle = root.querySelector('#dTitle');
    const dText = root.querySelector('#dText');
    let curIdx = -1;

    function setPlayUI() {
      if (!playBtn) return;
      playBtn.setAttribute('aria-label', playing ? 'Pausar animación' : 'Reproducir animación');
      if (playText) playText.textContent = playing ? 'Pausar' : 'Reproducir';
      if (playIcon) {
        playIcon.innerHTML = playing
          ? '<rect x="6" y="5" width="4.5" height="14" rx="1"/><rect x="13.5" y="5" width="4.5" height="14" rx="1"/>'
          : '<path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z"/>';
      }
    }

    function updateUI() {
      const idx = T < B[1] ? 0 : T < B[2] ? 1 : T < B[3] ? 2 : 3;
      if (idx !== curIdx) {
        curIdx = idx;
        stepBtns.forEach((b, k) => {
          b.setAttribute('aria-current', k === idx ? 'true' : 'false');
        });
        if (dTitle) dTitle.textContent = STAGES[idx].t;
        if (dText) dText.textContent = STAGES[idx].d;
        if (seek) seek.setAttribute('aria-valuetext', STAGES[idx].t);
      }
      stepBars.forEach((bar, k) => {
        if (!bar) return;
        const v = k < idx ? 1 : k > idx ? 0 : seg(T, B[k], B[k + 1]);
        bar.style.transform = 'scaleX(' + v.toFixed(3) + ')';
      });
      if (seek) seek.value = String(Math.round(T * 1000));
    }

    let dirty = true;
    let visible = true;
    let last = performance.now();
    let animId = 0;

    function frame(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (visible && playing) {
        // Avance de animación 50% más rápido
        T += dt / LOOP;
        if (T >= 1) T -= 1;
        amb += dt * 1.5;
        dirty = true;
      }
      if (dirty && visible) {
        renderScene();
        updateUI();
        dirty = false;
      }
      animId = requestAnimationFrame(frame);
    }

    const onPlayClick = () => {
      playing = !playing;
      setPlayUI();
    };

    const onSeekInput = () => {
      if (!seek) return;
      T = Math.min(0.999, Math.max(0, Number(seek.value) / 1000));
      playing = false;
      setPlayUI();
      dirty = true;
    };

    const stepClickHandlers = stepBtns.map((b) => {
      const handler = () => {
        const iAttr = b.getAttribute('data-i');
        const i = iAttr ? Number(iAttr) : 0;
        T = B[i] + 0.02;
        dirty = true;
      };
      b.addEventListener('click', handler);
      return { btn: b, handler };
    });

    playBtn?.addEventListener('click', onPlayClick);
    seek?.addEventListener('input', onSeekInput);

    let observer: IntersectionObserver | null = null;
    if (typeof window !== 'undefined' && 'IntersectionObserver' in window && scene) {
      observer = new IntersectionObserver(
        (entries) => {
          visible = entries[0]?.isIntersecting ?? true;
          if (visible) {
            dirty = true;
            last = performance.now();
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(scene);
    }

    setPlayUI();
    renderScene();
    updateUI();
    animId = requestAnimationFrame((t) => {
      last = t;
      frame(t);
    });

    return () => {
      cancelAnimationFrame(animId);
      observer?.disconnect();
      playBtn?.removeEventListener('click', onPlayClick);
      seek?.removeEventListener('input', onSeekInput);
      stepClickHandlers.forEach(({ btn, handler }) => {
        btn.removeEventListener('click', handler);
      });
    };
  }, []);

  return (
    <section
      className="home-histology-fact home-reveal diapedesis-fact"
      id="diapedesis"
      aria-labelledby="diap-title"
      ref={rootRef}
    >
      <span className="home-fact-shine" aria-hidden="true" />
      <span className="home-fact-glow home-fact-glow-cyan" aria-hidden="true" />
      <span className="home-fact-glow home-fact-glow-violet" aria-hidden="true" />
      <span className="home-histology-fact-mesh" aria-hidden="true" />

      <div className="home-diapedesis-grid">
        {/* ─── Columna Izquierda: Encabezado, Descripción, Etapas y Controles ─── */}
        <div className="home-diapedesis-left">
          <div className="home-histology-fact-brand">
            <div className="home-histology-fact-icon" aria-hidden="true">
              <Microscope size={18} />
            </div>
            <span className="home-histology-fact-label">
              <Sparkles size={13} /> Dato histológico de la semana
            </span>
          </div>

          <div className="diap-header-text">
            <h2 id="diap-title">Diapédesis</h2>
            <p className="sub">
              Cómo un leucocito sale del torrente sanguíneo y atraviesa la pared del vaso hasta llegar al tejido infectado.
            </p>
          </div>

          <div className="detail" aria-live="polite">
            <h3 id="dTitle">{STAGES[0].t}</h3>
            <p id="dText">{STAGES[0].d}</p>
          </div>

          <ol className="steps" id="steps">
            <li>
              <button type="button" className="step" data-i="0" aria-current="true">
                <span className="n">1</span>
                <span className="t">Rodamiento</span>
                <span className="bar" />
              </button>
            </li>
            <li>
              <button type="button" className="step" data-i="1" aria-current="false">
                <span className="n">2</span>
                <span className="t">Adhesión firme</span>
                <span className="bar" />
              </button>
            </li>
            <li>
              <button type="button" className="step" data-i="2" aria-current="false">
                <span className="n">3</span>
                <span className="t">Diapédesis</span>
                <span className="bar" />
              </button>
            </li>
            <li>
              <button type="button" className="step" data-i="3" aria-current="false">
                <span className="n">4</span>
                <span className="t">Migración hacia el foco</span>
                <span className="bar" />
              </button>
            </li>
          </ol>

          <div className="controls">
            <button type="button" className="play" id="play" aria-label="Pausar animación">
              <svg viewBox="0 0 24 24" aria-hidden="true" id="playIcon">
                <rect x="6" y="5" width="4.5" height="14" rx="1" />
                <rect x="13.5" y="5" width="4.5" height="14" rx="1" />
              </svg>
              <span id="playText">Pausar</span>
            </button>
            <input type="range" id="seek" min="0" max="1000" defaultValue="0" aria-label="Progreso de la animación" />
          </div>

          <ul className="legend" aria-label="Leyenda">
            <li>
              <i style={{ background: '#A9B6F6', borderColor: '#4B5BD0' }} />
              Leucocito
            </li>
            <li>
              <i style={{ background: '#F0B429', borderColor: '#B0740D' }} />
              Selectinas
            </li>
            <li>
              <i style={{ background: '#2CB79A', borderColor: '#0D6B58' }} />
              ICAM-1 e integrinas
            </li>
            <li>
              <i style={{ background: '#A23F9A', borderColor: '#6E2168' }} />
              Quimiocinas
            </li>
          </ul>
        </div>

        {/* ─── Columna Derecha: Esquema SVG Dinámico ─── */}
        <div className="home-diapedesis-right">
          <div className="frame">
            <svg className="scene" id="scene" viewBox="0 0 900 480" role="img" aria-labelledby="scene-title scene-desc">
              <title id="scene-title">Esquema animado de la diapédesis</title>
              <desc id="scene-desc">
                Un leucocito rueda sobre el endotelio de un vaso, se adhiere con firmeza, se desliza entre dos células endoteliales, atraviesa la membrana basal y sigue un gradiente de quimiocinas hasta un foco de infección.
              </desc>
              <defs>
                <clipPath id="lumenClip">
                  <rect x="0" y="0" width="900" height="199" />
                </clipPath>
                <clipPath id="tissueClip">
                  <rect x="0" y="240" width="900" height="240" />
                </clipPath>
              </defs>

              <rect x="0" y="0" width="900" height="480" fill="#F0EAF0" />
              <rect x="0" y="0" width="900" height="205" fill="#FCE8E2" />

              <g fill="none" stroke="#E2D8E4" strokeWidth="3" strokeLinecap="round">
                <path d="M-10 300 C90 268 190 336 320 304 S560 326 700 298 S850 320 920 302" />
                <path d="M-10 356 C120 388 230 330 380 362 S620 392 760 350 S880 340 920 360" />
                <path d="M-10 420 C110 396 250 448 400 418 S600 440 720 424" />
                <path d="M120 258 C200 276 280 252 360 270 S500 262 560 274" />
              </g>

              <g id="halo">
                <circle id="halo1" cx="830" cy="418" r="64" fill="#A23F9A" opacity="0.08" />
                <circle id="halo2" cx="830" cy="418" r="110" fill="#A23F9A" opacity="0.05" />
              </g>
              <g id="diffuse" clipPath="url(#tissueClip)" />
              <g id="bact" />

              <g id="bm" stroke="#B99CC1" strokeWidth="3.5" strokeLinecap="round" fill="none">
                <path id="bmL" d="M-10 234 H462" />
                <path id="bmR" d="M478 234 H910" />
              </g>

              <g id="endo" />
              <g id="mol" />
              <g id="rbc" clipPath="url(#lumenClip)" />

              <g id="leuk">
                <path id="body" fill="#A9B6F6" stroke="#4B5BD0" strokeWidth="2" strokeLinejoin="round" d="M0 0" />
                <g id="grans" />
                <g id="lobes" />
              </g>
              <g id="bonds" />

              <g className="lab">
                <text x="14" y="26" fill="#8A3A31">Luz del vaso</text>
                <text x="14" y="212" dominantBaseline="central" fill="#5A1D16">Endotelio</text>
                <text x="14" y="254" fill="#5E4870">Membrana basal</text>
                <text x="14" y="292" fill="#5E4870">Tejido</text>
                <text x="520" y="462" fill="#7A2C74">Gradiente de quimiocinas</text>
                <text x="830" y="466" textAnchor="middle" fill="#7A2C74">Foco de infección</text>
              </g>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HomeHistologyFact;
