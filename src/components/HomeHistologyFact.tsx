import React, { useEffect, useRef, useState } from 'react';
import { Microscope, Play, Pause, Syringe } from 'lucide-react';
import '../styles/homeHistologyFact.css';

const NS = 'http://www.w3.org/2000/svg';

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
  parent?: Element | null
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) {
    el.setAttribute(k, String(attrs[k]));
  }
  if (parent) parent.appendChild(el);
  return el as SVGElementTagNameMap[K];
}

function clearNode(node: Element) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

export interface AxisData {
  lab: string;
  h1: string;
  h1n: string;
  h2: string;
  h2n: string;
  h3: string;
  gl: string;
  gla: string;
  org: string;
  orgt: string;
  eff: string;
  a2: string;
  a3: string;
}

export const AXES: Record<'tir' | 'adr' | 'gon', AxisData> = {
  tir: {
    lab: 'Eje tiroideo',
    h1: 'TRH',
    h1n: 'hormona liberadora de tirotropina',
    h2: 'TSH',
    h2n: 'tirotropina',
    h3: 'T3 / T4',
    gl: 'Tiroides',
    gla: 'la tiroides',
    org: 'Todos los tejidos',
    orgt: 'todos los tejidos',
    eff: 'mayor consumo de oxígeno y metabolismo basal',
    a2: 'thy',
    a3: 'body',
  },
  adr: {
    lab: 'Eje suprarrenal',
    h1: 'CRH',
    h1n: 'hormona liberadora de corticotropina',
    h2: 'ACTH',
    h2n: 'corticotropina',
    h3: 'Cortisol',
    gl: 'Suprarrenal',
    gla: 'la corteza suprarrenal',
    org: 'Hígado y músculo',
    orgt: 'el hígado y el músculo',
    eff: 'se moviliza glucosa y se modula la inflamación',
    a2: 'adr',
    a3: 'liver',
  },
  gon: {
    lab: 'Eje gonadal (masculino)',
    h1: 'GnRH',
    h1n: 'hormona liberadora de gonadotropinas',
    h2: 'LH / FSH',
    h2n: 'gonadotropinas',
    h3: 'Testosterona',
    gl: 'Testículo',
    gla: 'el testículo',
    org: 'Músculo y hueso',
    orgt: 'el músculo y el hueso',
    eff: 'se mantienen la masa muscular, el hueso y la función reproductora',
    a2: 'test',
    a3: 'bone',
  },
};

export function getAxisTexts(a: AxisData): [string, string][] {
  return [
    [
      'Hipotálamo',
      `Neuronas neurosecretoras del hipotálamo liberan ${a.h1} (${a.h1n}) en la eminencia media. Los capilares del sistema porta hipofisario lo llevan directo a la adenohipófisis.`,
    ],
    [
      'Adenohipófisis',
      `Las células de la adenohipófisis detectan ${a.h1} y liberan ${a.h2} (${a.h2n}) a la circulación general. Es una señal trófica: su blanco es otra glándula.`,
    ],
    [
      'Glándula y órgano diana',
      `${a.h2} estimula a ${a.gla} para producir ${a.h3}. Esta señal llega por la sangre a ${a.orgt}: ${a.eff}.`,
    ],
    [
      'Retroalimentación negativa',
      `Cuando ${a.h3} aumenta en sangre, inhibe al hipotálamo y a la hipófisis y baja su propia producción; si disminuye, se libera la inhibición y el eje se reactiva. Es el asa larga que mantiene el nivel estable.`,
    ],
  ];
}

const DURATIONS = [5000, 5000, 5000, 9000];
const CUM_TIMES = [0, 5000, 10000, 15000];
const T_TOTAL = 24000;
const TAB_NAMES = ['Hipotálamo', 'Hipófisis', 'Glándula y órgano', 'Retroalimentación'];

const NODE_COLORS: [string, string][] = [
  ['#e3dcf7', '#7a5cc7'],
  ['#fde8c7', '#f2a13a'],
  ['#d2f0ec', '#2fa39a'],
  ['#f6dcd5', '#b8607e'],
];

const MUS =
  '<ellipse rx="30" ry="9" fill="#e07a6a" stroke="#a84a40" stroke-width="1.4"/><path d="M-20-6V6M-10-8V8M0-9V9M10-8V8M20-6V6" stroke="#f2b0a6" stroke-width="1.6"/>';

const ART: Record<string, string> = {
  hyp:
    '<path d="M-46 4C-48-22-26-36 0-34C26-36 48-22 46 2C45 18 30 26 14 24L10 30L-4 30L-8 24C-30 26-45 20-46 4Z" fill="#f1d6dc" stroke="#b8607e" stroke-width="1.6"/>' +
    '<path d="M-34-12C-28-22-18-22-12-14M-4-24C4-16 12-16 18-24M26-12C32-4 28 4 20 4M-34 6C-26 0-20 4-14 0" fill="none" stroke="#d9a5b3" stroke-width="1.6" stroke-linecap="round"/>' +
    '<ellipse cx="0" cy="10" rx="13" ry="8" fill="#7a5cc7"/><circle cx="-5" cy="8" r="2.2" fill="#e3dcf7"/><circle cx="4" cy="11" r="2.2" fill="#e3dcf7"/><circle cx="0" cy="6" r="1.8" fill="#e3dcf7"/>' +
    '<path d="M0 17C0 24 2 28 2 36" stroke="#7a5cc7" stroke-width="4.5" stroke-linecap="round" fill="none"/>',
  pit:
    '<path d="M-40-4Q-36 36 0 36Q36 36 40-4" fill="none" stroke="#b9a58a" stroke-width="4.5" stroke-linecap="round"/>' +
    '<path d="M0-38C0-28-2-22-4-12" stroke="#7a5cc7" stroke-width="4.5" stroke-linecap="round" fill="none"/>' +
    '<ellipse cx="-9" cy="10" rx="23" ry="19" fill="#f2a13a" stroke="#c97a10" stroke-width="1.5"/>' +
    '<circle cx="-16" cy="6" r="2.4" fill="#c97a10"/><circle cx="-6" cy="14" r="2.4" fill="#c97a10"/><circle cx="-18" cy="16" r="2" fill="#c97a10"/><circle cx="-4" cy="3" r="2" fill="#c97a10"/>' +
    '<ellipse cx="17" cy="9" rx="10" ry="14" fill="#f7dcae" stroke="#c9a36a" stroke-width="1.5"/>',
  thy:
    '<rect x="-6" y="-36" width="12" height="72" rx="5" fill="#d5e8f0" stroke="#7aa7bd" stroke-width="1.4"/><path d="M-6-26H6M-6-16H6M-6-6H6M-6 4H6M-6 14H6M-6 24H6" stroke="#7aa7bd" stroke-width="1.2"/>' +
    '<ellipse cx="-18" cy="-2" rx="12" ry="22" transform="rotate(-10 -18 -2)" fill="#2fa39a" stroke="#1f7d76" stroke-width="1.6"/>' +
    '<ellipse cx="18" cy="-2" rx="12" ry="22" transform="rotate(10 18 -2)" fill="#2fa39a" stroke="#1f7d76" stroke-width="1.6"/>' +
    '<rect x="-10" y="6" width="20" height="8" rx="4" fill="#2fa39a" stroke="#1f7d76" stroke-width="1.6"/>' +
    '<circle cx="-19" cy="-10" r="3" fill="#a8e0da"/><circle cx="-16" cy="2" r="2.6" fill="#a8e0da"/><circle cx="19" cy="-10" r="3" fill="#a8e0da"/><circle cx="16" cy="2" r="2.6" fill="#a8e0da"/>',
  adr:
    '<path d="M-34 26C-50 14-48-6-30-12C-12-16 14-16 30-10C48-4 50 16 36 28C24 38-18 38-34 26Z" fill="#d98aa3" stroke="#b8607e" stroke-width="1.6"/><ellipse cx="0" cy="26" rx="9" ry="5" fill="#f6dcd5" stroke="#b8607e"/>' +
    '<path d="M-18-2L0-34L20-2Q0 4-18-2Z" fill="#2fa39a" stroke="#1f7d76" stroke-width="1.8" stroke-linejoin="round"/><ellipse cx="1" cy="-12" rx="5" ry="9" fill="#145e58"/>',
  test:
    '<path d="M0-38V-24" stroke="#c9a5a0" stroke-width="5" stroke-linecap="round"/>' +
    '<ellipse cx="-4" cy="6" rx="24" ry="30" fill="#2fa39a" stroke="#1f7d76" stroke-width="1.6"/>' +
    '<path d="M-18 0C-10-8-2 8 6 0M-20 12C-12 4-4 20 6 12M-14 22C-8 16 0 26 6 22" fill="none" stroke="#a8e0da" stroke-width="2" stroke-linecap="round"/>' +
    '<path d="M10-22C34-16 34 22 14 32" fill="none" stroke="#1f7d76" stroke-width="7" stroke-linecap="round"/><path d="M10-22C34-16 34 22 14 32" fill="none" stroke="#7fcfc7" stroke-width="3" stroke-dasharray="2 3" stroke-linecap="round"/>',
  body:
    '<circle cx="0" cy="-28" r="8" fill="#e8a0a8" stroke="#b8607e" stroke-width="1.5"/><rect x="-12" y="-17" width="24" height="30" rx="10" fill="#e8a0a8" stroke="#b8607e" stroke-width="1.5"/>' +
    '<path d="M-14-12L-26 8M14-12L26 8" stroke="#e8a0a8" stroke-width="7" stroke-linecap="round"/><path d="M-5 12L-8 34M5 12L8 34" stroke="#e8a0a8" stroke-width="8" stroke-linecap="round"/>' +
    '<circle cx="-4" cy="-8" r="2" fill="#fff" opacity=".7"/><circle cx="5" cy="0" r="2" fill="#fff" opacity=".7"/><circle cx="-3" cy="8" r="2" fill="#fff" opacity=".7"/>',
  liver:
    '<g transform="translate(-4,-8) scale(.9)"><path d="M-44-6C-30-28 22-30 44-10C48 4 30 20 4 22C-14 24-36 16-44-6Z" fill="#b5665f" stroke="#8a403b" stroke-width="1.6"/><path d="M-10-14C0-10 6 4 2 18" stroke="#8a403b" stroke-width="1.4" fill="none"/><ellipse cx="14" cy="18" rx="6" ry="4" fill="#6f9a45"/></g>' +
    '<g transform="translate(8,28)">' +
    MUS +
    '</g>',
  bone:
    '<g transform="translate(0,-14)"><rect x="-34" y="-5" width="68" height="10" rx="5" fill="#f1e6d2" stroke="#b9a58a" stroke-width="1.5"/>' +
    '<circle cx="-36" cy="-6" r="7" fill="#f1e6d2" stroke="#b9a58a" stroke-width="1.5"/><circle cx="-36" cy="6" r="7" fill="#f1e6d2" stroke="#b9a58a" stroke-width="1.5"/>' +
    '<circle cx="36" cy="-6" r="7" fill="#f1e6d2" stroke="#b9a58a" stroke-width="1.5"/><circle cx="36" cy="6" r="7" fill="#f1e6d2" stroke="#b9a58a" stroke-width="1.5"/>' +
    '<rect x="-30" y="-3" width="60" height="6" rx="3" fill="#f1e6d2"/></g>' +
    '<g transform="translate(0,22) scale(1.2)">' +
    MUS +
    '</g>',
};

function fitText(el: SVGTextElement, txt: string, base: number, w: number) {
  el.textContent = txt;
  const len = txt.length || 1;
  el.setAttribute('font-size', String(Math.min(base, w / (len * 0.58))));
}

interface ParticleItem {
  e: SVGCircleElement;
  p: SVGPathElement;
  L: number;
  o: number;
  k: number;
  sp: number;
}

interface NodeItem {
  g: SVGGElement;
  r: SVGEllipseElement;
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
  const [selectedAxis, setSelectedAxis] = useState<'tir' | 'adr' | 'gon'>('tir');

  // Mantener referencias para interacción directa suave
  const selectedAxisRef = useRef<'tir' | 'adr' | 'gon'>('tir');
  selectedAxisRef.current = selectedAxis;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const fig = root.querySelector('#fig') as HTMLElement | null;
    const sv = root.querySelector('#sv') as SVGSVGElement | null;
    const gFb = root.querySelector('#gFb') as SVGGElement | null;
    const gLk = root.querySelector('#gLk') as SVGGElement | null;
    const gN = root.querySelector('#gN') as SVGGElement | null;
    const gPt = root.querySelector('#gPt') as SVGGElement | null;
    const gG = root.querySelector('#gG') as SVGGElement | null;

    const dhEl = root.querySelector('#dh') as HTMLElement | null;
    const dpEl = root.querySelector('#dp') as HTMLElement | null;
    const playBtn = root.querySelector('#pb') as HTMLButtonElement | null;
    const slider = root.querySelector('#sl') as HTMLInputElement | null;
    const injBtn = root.querySelector('#inj') as HTMLButtonElement | null;
    const injLabel = root.querySelector('#inj-label') as HTMLSpanElement | null;
    const tabBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.hypo-tab'));
    const axisBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.hypo-axes button'));

    if (!fig || !sv || !gFb || !gLk || !gN || !gPt || !gG) return;

    let t = 0;
    let clk = 0;
    let hormoneLevel = 0.1;
    let play = true;
    let last = 0;
    let cur = -1;
    let drag = false;
    let built = false;
    let W = 640;
    let VH = 400;
    let prod = 1;
    const la = [0, 0, 0, 0, 0];

    let NODES: NodeItem[] = [];
    let PT: ParticleItem[] = [];
    let GF: SVGRectElement | null = null;
    let GL: SVGTextElement | null = null;

    let stageTexts = getAxisTexts(AXES[selectedAxisRef.current]);

    function updateTexts() {
      const currentAxis = AXES[selectedAxisRef.current];
      stageTexts = getAxisTexts(currentAxis);
      const st = Math.max(0, Math.min(3, cur < 0 ? 0 : cur));
      if (dhEl) dhEl.textContent = stageTexts[st][0];
      if (dpEl) dpEl.textContent = stageTexts[st][1];
      if (injLabel) injLabel.textContent = `Subir ${currentAxis.h3}`;
      if (injBtn) injBtn.setAttribute('aria-label', `Subir nivel de ${currentAxis.h3}`);
    }

    function build(nw: number, vh: number) {
      W = nw;
      VH = vh;
      built = true;
      const currentAxis = AXES[selectedAxisRef.current];

      [gFb, gLk, gN, gPt, gG].forEach((g) => {
        if (g) clearNode(g);
      });
      PT = [];
      NODES = [];

      const horiz = vh === 400;
      const m = 24;
      let slot = 0;
      let s = 1;
      const cx: number[] = [];
      const cy: number[] = [];

      if (horiz) {
        slot = clamp((nw - 2 * m) / 5.4, 88, 140);
        const g = (nw - 2 * m - 4 * slot) / 3;
        s = clamp(slot / 105, 0.72, 1.25);
        for (let i = 0; i < 4; i++) {
          cx[i] = m + slot / 2 + i * (slot + g);
          cy[i] = 124;
        }
      } else {
        s = 0.8;
        const x0 = clamp(nw * 0.2, 60, 130);
        for (let i = 0; i < 4; i++) {
          cx[i] = x0;
          cy[i] = 96 + i * 124;
        }
      }

      const hw = 50 * s;
      const hh = 44 * s;
      const tx0 = cx[0] + hw + 10;
      const maxw = clamp(nw - tx0 - 70, 70, 118);
      const xe = tx0 + maxw;

      // ─── Retroalimentación negativa (asa larga) ───
      const fbD: string[] = [];
      if (horiz) {
        const yb = cy[2] + hh + 33;
        fbD.push(
          `M${cx[2] - 10} ${yb + 2} C${cx[2] - 10} ${yb + 90} ${cx[1]} ${yb + 90} ${cx[1]} ${yb + 7}`
        );
        fbD.push(
          `M${cx[2] + 10} ${yb + 2} C${cx[2] + 10} ${yb + 150} ${cx[0]} ${yb + 150} ${cx[0]} ${yb + 7}`
        );
        const lab = createSvgElement(
          'text',
          {
            x: (cx[0] + cx[2]) / 2,
            y: yb + 156,
            'text-anchor': 'middle',
            'font-weight': 700,
            style: 'fill:#d64550',
          },
          gFb
        );
        lab.textContent = 'Retroalimentación negativa (−)';
      } else {
        const av = Math.max(24, nw - xe - 16);
        const d1 = av * 0.5;
        const d2 = av;
        fbD.push(
          `M${xe + 4} ${cy[2] + 8} C${xe + 4 + d1} ${cy[2] + 8} ${xe + 4 + d1} ${cy[1]} ${xe + 10} ${cy[1]}`
        );
        fbD.push(
          `M${xe + 4} ${cy[2] - 8} C${xe + 4 + d2} ${cy[2] - 8} ${xe + 4 + d2} ${cy[0]} ${xe + 10} ${cy[0]}`
        );
        const lab = createSvgElement(
          'text',
          {
            transform: `translate(${nw - 8} ${(cy[0] + cy[2]) / 2}) rotate(-90)`,
            'text-anchor': 'middle',
            'font-weight': 700,
            'font-size': 10,
            style: 'fill:#d64550',
          },
          gFb
        );
        lab.textContent = 'Retroalimentación negativa (−)';
      }

      const fbEl: SVGPathElement[] = fbD.map((d) =>
        createSvgElement(
          'path',
          {
            d,
            fill: 'none',
            stroke: '#d64550',
            'stroke-width': 2.2,
            'stroke-dasharray': '6 5',
            'marker-end': 'url(#ih)',
          },
          gFb
        )
      );

      // ─── Enlaces directos estimulantes ───
      const lk: SVGPathElement[] = [];
      const linkColors = ['#7a5cc7', '#f2a13a', '#2fa39a'];
      for (let i = 0; i < 3; i++) {
        const d = horiz
          ? `M${cx[i] + hw + 3} ${cy[i]} L${cx[i + 1] - hw - 6} ${cy[i + 1]}`
          : `M${cx[i]} ${cy[i] + hh + 3} L${cx[i + 1]} ${cy[i + 1] - hh - 6}`;
        lk.push(
          createSvgElement(
            'path',
            {
              d,
              fill: 'none',
              stroke: linkColors[i],
              'stroke-width': 2.4,
              'marker-end': `url(#a${i})`,
              class: 'g',
            },
            gLk
          )
        );
      }

      // ─── Nodos Anatómicos ───
      const arts = ['hyp', 'pit', currentAxis.a2, currentAxis.a3];
      const names = ['Hipotálamo', 'Adenohipófisis', currentAxis.gl, 'Órgano diana'];
      const subs = [
        `secreta ${currentAxis.h1}`,
        `secreta ${currentAxis.h2}`,
        `secreta ${currentAxis.h3}`,
        currentAxis.org,
      ];

      for (let i = 0; i < 4; i++) {
        const gg = createSvgElement('g', { class: 'g' }, gN);
        const r = createSvgElement(
          'ellipse',
          {
            cx: cx[i],
            cy: cy[i],
            rx: hw,
            ry: hh,
            fill: NODE_COLORS[i][0],
            'fill-opacity': 0.6,
            stroke: NODE_COLORS[i][1],
          },
          gg
        );
        const dg = createSvgElement(
          'g',
          { transform: `translate(${cx[i]} ${cy[i]}) scale(${s})` },
          gg
        );
        dg.innerHTML = ART[arts[i]] || '';

        if (horiz) {
          const n1 = createSvgElement(
            'text',
            { x: cx[i], y: cy[i] + hh + 16, 'text-anchor': 'middle', 'font-weight': 700 },
            gg
          );
          const n2 = createSvgElement(
            'text',
            { x: cx[i], y: cy[i] + hh + 29, 'text-anchor': 'middle', style: 'opacity:.8' },
            gg
          );
          fitText(n1, names[i], 12.5, slot * 0.95);
          fitText(n2, subs[i], 10.5, slot * 0.95);
        } else {
          const n1 = createSvgElement(
            'text',
            { x: tx0, y: cy[i] - 2, 'font-weight': 700 },
            gg
          );
          const n2 = createSvgElement(
            'text',
            { x: tx0, y: cy[i] + 13, style: 'opacity:.8' },
            gg
          );
          fitText(n1, names[i], 13, maxw);
          fitText(n2, subs[i], 10.5, maxw);
        }

        NODES.push({ g: gg, r });
      }

      // ─── Partículas hormonales en movimiento ───
      function mk(
        path: SVGPathElement,
        n: number,
        col: string,
        rad: number,
        k: number,
        sp: number
      ) {
        const Ln = typeof path.getTotalLength === 'function' ? path.getTotalLength() : 100;
        for (let j = 0; j < n; j++) {
          PT.push({
            e: createSvgElement('circle', { r: rad, fill: col }, gPt),
            p: path,
            L: Ln,
            o: j / n + k * 0.13,
            k,
            sp,
          });
        }
      }

      mk(lk[0], 4, '#7a5cc7', 3.6, 0, 0.32);
      mk(lk[1], 4, '#f2a13a', 3.6, 1, 0.32);
      mk(lk[2], 4, '#2fa39a', 3.6, 2, 0.32);
      mk(fbEl[0], 5, '#d64550', 3.2, 3, 0.16);
      mk(fbEl[1], 6, '#d64550', 3.2, 4, 0.13);

      // ─── Medidor dinámico del nivel hormonal ───
      const bw = Math.min(190, nw * 0.42);
      const gx = m;
      const gy = horiz ? 36 : 30;

      GL = createSvgElement(
        'text',
        { x: gx, y: gy - 8, 'font-weight': 700, 'font-size': 11 },
        gG
      );
      GL.textContent = `Nivel de ${currentAxis.h3}`;

      createSvgElement(
        'rect',
        { x: gx, y: gy, width: bw, height: 11, rx: 5.5, fill: '#e8ecf7', stroke: '#c9d3ea' },
        gG
      );

      GF = createSvgElement(
        'rect',
        { x: gx, y: gy, width: 20, height: 11, rx: 5.5, fill: '#2fa39a' },
        gG
      );
      (GF as any).bw = bw;

      createSvgElement(
        'path',
        {
          d: `M${gx + bw * 0.476} ${gy - 3}V${gy + 14}`,
          stroke: '#12244a',
          'stroke-width': 1.5,
        },
        gG
      );

      const nt = createSvgElement(
        'text',
        {
          x: gx + bw * 0.476,
          y: gy + 25,
          'text-anchor': 'middle',
          'font-size': 9.5,
          style: 'opacity:.75',
        },
        gG
      );
      nt.textContent = 'nivel normal';

      cur = -1;
      draw();
    }

    function stepOf(): number {
      for (let i = 3; i >= 0; i--) {
        if (t >= CUM_TIMES[i]) return i;
      }
      return 0;
    }

    function draw() {
      if (!built) return;
      const st = stepOf();
      const fr = (t - CUM_TIMES[st]) / DURATIONS[st];

      if (st !== cur) {
        cur = st;
        if (st === 3) hormoneLevel = 0.1;

        if (dhEl) dhEl.textContent = stageTexts[st][0];
        if (dpEl) dpEl.textContent = stageTexts[st][1];

        tabBtns.forEach((b, i) => {
          b.classList.toggle('on', i === st);
        });

        NODES.forEach((n, i) => {
          n.g.style.opacity = String(i <= st + 1 ? 1 : 0.25);
          n.r.setAttribute('stroke-width', i === st || st === 3 ? '3' : '1.5');
        });

        if (gLk) {
          const lks = gLk.children;
          for (let k = 0; k < lks.length; k++) {
            (lks[k] as HTMLElement).style.opacity = String(st >= k ? 1 : 0.18);
          }
        }

        if (gFb) gFb.style.opacity = String(st === 3 ? 1 : 0.2);
        if (gG) gG.style.opacity = String(st === 3 ? 1 : 0);
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

    function anim(dt: number) {
      const tg = [cur >= 0, cur >= 1, cur >= 2, cur === 3, cur === 3];
      for (let i = 0; i < 5; i++) {
        la[i] += ((tg[i] ? 1 : 0) - la[i]) * Math.min(1, dt * 6);
      }
      prod = cur === 3 ? clamp(1 - 1.6 * hormoneLevel, 0, 1) : 1;

      PT.forEach((q) => {
        const p = (clk * q.sp + q.o) % 1;
        const pt =
          typeof q.p.getPointAtLength === 'function'
            ? q.p.getPointAtLength(p * q.L)
            : { x: 0, y: 0 };
        const env = p < 0.12 ? p / 0.12 : p > 0.88 ? (1 - p) / 0.12 : 1;
        const m = q.k < 3 ? (cur === 3 ? 0.12 + 0.88 * prod : 1) : clamp(hormoneLevel / 0.45, 0, 1);
        q.e.setAttribute('cx', String(pt.x));
        q.e.setAttribute('cy', String(pt.y));
        q.e.setAttribute('opacity', String(env * la[q.k] * m));
      });

      if (GF) {
        const maxBw = (GF as any).bw || 100;
        GF.setAttribute('width', String(Math.max(10, maxBw * clamp(hormoneLevel, 0, 1))));
        GF.setAttribute('fill', hormoneLevel > 0.65 ? '#d64550' : '#2fa39a');
      }
    }

    let rafId: number | null = null;
    function loop(ts: number) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      if (play || drag) clk += dt;
      if (play && !drag) {
        t += dt * 1000;
        if (t >= T_TOTAL) t = 0;
        if (cur === 3) {
          prod = clamp(1 - 1.6 * hormoneLevel, 0, 1);
          hormoneLevel = clamp(hormoneLevel + dt * (0.6 * prod - 0.3 * hormoneLevel), 0, 1.1);
        }
      }
      draw();
      anim(dt);
      rafId = requestAnimationFrame(loop);
    }

    let pend = false;
    function fit() {
      pend = false;
      const w = fig ? fig.clientWidth : 640;
      const h = fig ? fig.clientHeight : 400;
      if (!w || !h) return;
      const r = w / h;
      const vh = r * 400 >= 500 ? 400 : 520;
      const nw = Math.max(300, Math.round(vh * r));
      if (sv) sv.setAttribute('viewBox', `0 0 ${nw} ${vh}`);
      if (nw !== W || vh !== VH || !built) {
        build(nw, vh);
      }
    }

    function reqFit() {
      if (!pend) {
        pend = true;
        requestAnimationFrame(fit);
      }
    }

    let resizeObserver: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window && fig) {
      resizeObserver = new ResizeObserver(reqFit);
      resizeObserver.observe(fig);
    }
    window.addEventListener('resize', reqFit);

    updateTexts();
    fit();

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
    };

    const handleSliderChange = () => {
      drag = false;
    };

    const handleInjClick = () => {
      if (cur !== 3) {
        t = CUM_TIMES[3] + 200;
        drag = false;
        draw();
      }
      hormoneLevel = Math.min(1.1, hormoneLevel + 0.55);
      play = true;
      setIsPlaying(true);
    };

    const handleTabClick = (idx: number) => {
      t = CUM_TIMES[idx];
      drag = false;
      draw();
    };

    const handleAxisClick = (key: 'tir' | 'adr' | 'gon') => {
      setSelectedAxis(key);
      selectedAxisRef.current = key;
      updateTexts();
      hormoneLevel = 0.1;
      build(W, VH);
    };

    if (playBtn) playBtn.addEventListener('click', handlePlayClick);
    if (slider) {
      slider.addEventListener('input', handleSliderInput);
      slider.addEventListener('change', handleSliderChange);
    }
    if (injBtn) injBtn.addEventListener('click', handleInjClick);

    tabBtns.forEach((btn, idx) => {
      btn.addEventListener('click', () => handleTabClick(idx));
    });

    axisBtns.forEach((btn) => {
      const axisKey = btn.getAttribute('data-axis') as 'tir' | 'adr' | 'gon';
      if (axisKey) {
        btn.addEventListener('click', () => handleAxisClick(axisKey));
      }
    });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', reqFit);
      if (playBtn) playBtn.removeEventListener('click', handlePlayClick);
      if (slider) {
        slider.removeEventListener('input', handleSliderInput);
        slider.removeEventListener('change', handleSliderChange);
      }
      if (injBtn) injBtn.removeEventListener('click', handleInjClick);
    };
  }, []);

  const activeAxisData = AXES[selectedAxis];

  return (
    <section
      ref={rootRef}
      className={`home-histology-fact hypo-fact ${className}`}
      aria-label="Dato histológico de la semana: Eje hipotálamo-hipófisis"
    >
      <span className="hypo-fact-shine" aria-hidden="true" />
      <span className="hypo-fact-glow hypo-fact-glow-cyan" aria-hidden="true" />
      <span className="hypo-fact-glow hypo-fact-glow-violet" aria-hidden="true" />

      <div className="hypo-grid">
        <div className="hypo-info">
          <div className="hypo-top">
            <span className="hypo-badge">
              <Microscope size={13} className="hypo-badge-icon" />
              <span>{badgeLabel.toUpperCase()}</span>
            </span>
          </div>

          <div className="hypo-header">
            <h2>Eje hipotálamo-hipófisis</h2>
            <p className="sub">
              Una cascada hormonal que se regula sola: del hipotálamo al órgano diana, con retroalimentación negativa.
            </p>
          </div>

          <div className="hypo-axes" role="group" aria-label="Elegir eje hormonal">
            {(['tir', 'adr', 'gon'] as const).map((key) => (
              <button
                key={key}
                type="button"
                data-axis={key}
                className={selectedAxis === key ? 'on' : ''}
              >
                {AXES[key].lab}
              </button>
            ))}
          </div>

          <div className="hypo-desc">
            <h3 id="dh">Hipotálamo</h3>
            <p id="dp">
              Neuronas neurosecretoras del hipotálamo liberan {activeAxisData.h1} ({activeAxisData.h1n}) en la eminencia media.
            </p>
          </div>

          <div className="hypo-tabs" role="tablist" aria-label="Etapas del eje">
            {TAB_NAMES.map((name, i) => (
              <button
                key={name}
                type="button"
                role="tab"
                className={`hypo-tab ${i === 0 ? 'on' : ''}`}
                aria-label={`Etapa ${i + 1}: ${name}`}
              >
                <small>{i + 1}</small>
                <b>{name}</b>
                <i style={{ width: i === 0 ? '0%' : '0%' }} />
              </button>
            ))}
          </div>

          <div className="hypo-ctl">
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
              aria-label="Progreso de la animación del eje hipotálamo-hipófisis"
            />
            <button
              id="inj"
              className="inj"
              type="button"
              aria-label={`Subir nivel de ${activeAxisData.h3}`}
            >
              <Syringe size={14} />
              <span id="inj-label">Subir {activeAxisData.h3}</span>
            </button>
          </div>

          <div className="hypo-leg" aria-label="Leyenda de señales hormonales">
            <span style={{ ['--c' as string]: '#7a5cc7' }}>Hormona liberadora</span>
            <span style={{ ['--c' as string]: '#f2a13a' }}>Hormona trófica (hipófisis)</span>
            <span style={{ ['--c' as string]: '#2fa39a' }}>Hormona de la glándula</span>
            <span style={{ ['--c' as string]: '#d64550' }}>Inhibición (−)</span>
          </div>
        </div>

        {/* ─── Figura SVG dinámica adaptable ─── */}
        <div className="hypo-fig" id="fig">
          <svg
            id="sv"
            viewBox="0 0 640 400"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Esquema del eje hipotálamo, hipófisis, glándula y órgano diana con retroalimentación negativa"
          >
            <defs>
              <marker
                id="a0"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="11"
                markerHeight="11"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M0 0L10 5L0 10Z" fill="#7a5cc7" />
              </marker>
              <marker
                id="a1"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="11"
                markerHeight="11"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M0 0L10 5L0 10Z" fill="#f2a13a" />
              </marker>
              <marker
                id="a2"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="11"
                markerHeight="11"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M0 0L10 5L0 10Z" fill="#2fa39a" />
              </marker>
              <marker
                id="ih"
                viewBox="0 0 8 16"
                refX="4"
                refY="8"
                markerWidth="8"
                markerHeight="16"
                markerUnits="userSpaceOnUse"
                orient="auto"
              >
                <path d="M4 0V16" stroke="#d64550" strokeWidth="3" />
              </marker>
            </defs>
            <g id="gFb" className="g" />
            <g id="gLk" />
            <g id="gN" />
            <g id="gPt" />
            <g id="gG" className="g" opacity="0" />
          </svg>
        </div>
      </div>
    </section>
  );
};

export default HomeHistologyFact;
