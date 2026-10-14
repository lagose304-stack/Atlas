import React, { useEffect, useRef, useState } from 'react';
import { Microscope, Play, Pause } from 'lucide-react';
import '../styles/homeHistologyFact.css';

const NS = 'http://www.w3.org/2000/svg';

function createSvgElement(tag: string, attrs: Record<string, string | number>, parent?: Element | null): SVGElement {
  const elem = document.createElementNS(NS, tag);
  for (const k in attrs) {
    elem.setAttribute(k, String(attrs[k]));
  }
  if (parent) {
    parent.appendChild(elem);
  }
  return elem;
}

function clearNode(node: Element) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function clamp(v: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, v));
}

const STAGES = [
  {
    title: 'Estratos de la epidermis',
    desc: 'Epitelio plano estratificado queratinizado. De profundo a superficial: basal, espinoso, granuloso, lúcido (solo en piel gruesa) y córneo.',
  },
  {
    title: 'Queratinocitos',
    desc: 'Son cerca del 90 % de la epidermis. Nacen por mitosis en el estrato basal, ascienden produciendo queratina, se aplanan y mueren como corneocitos sin núcleo que se descaman.',
  },
  {
    title: 'Melanocitos y células de Merkel',
    desc: 'En el estrato basal: los melanocitos transfieren melanosomas a los queratinocitos para protegerlos de la radiación UV. Las células de Merkel se asocian a terminaciones nerviosas y detectan el tacto.',
  },
  {
    title: 'Células de Langerhans',
    desc: 'Células dendríticas del estrato espinoso. Capturan antígenos que entran por la epidermis, migran a la dermis y al ganglio linfático para presentarlos a los linfocitos T.',
  },
];

const T_TOTAL = 20000;
const STEP = 5000;

interface TracerItem {
  g: SVGElement;
  b: SVGElement;
  n: SVGElement;
  cx: number;
  o: number;
}

interface MelanosomeItem {
  e: SVGElement;
  p: SVGPathElement;
  length: number;
  offset: number;
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

    const fig = root.querySelector('#fig') as HTMLElement | null;
    const sv = root.querySelector('#sv') as SVGSVGElement | null;
    const cr = root.querySelector('#cr') as SVGRectElement | null;
    const gD = root.querySelector('#gD') as SVGGElement | null;
    const gL = root.querySelector('#L') as SVGGElement | null;
    const bm = root.querySelector('#bm') as SVGPathElement | null;
    const lb = root.querySelector('#lb') as SVGGElement | null;
    const gMit = root.querySelector('#gMit') as SVGGElement | null;
    const tr = root.querySelector('#tr') as SVGGElement | null;
    const mt = root.querySelector('#mt') as SVGTextElement | null;
    const gT = root.querySelector('#gT') as SVGGElement | null;
    const gA = root.querySelector('#gA') as SVGGElement | null;
    const gM = root.querySelector('#gM') as SVGGElement | null;
    const gMel = root.querySelector('#gMel') as SVGGElement | null;
    const gMer = root.querySelector('#gMer') as SVGGElement | null;
    const dn = root.querySelector('#dn') as SVGGElement | null;
    const ms = root.querySelector('#ms') as SVGGElement | null;
    const rg = root.querySelector('#rg') as SVGCircleElement | null;
    const np = root.querySelector('#np') as SVGCircleElement | null;
    const mk1 = root.querySelector('#mk1') as SVGTextElement | null;
    const mk2 = root.querySelector('#mk2') as SVGTextElement | null;
    const gLangerhans = root.querySelector('#gL') as SVGGElement | null;
    const lc = root.querySelector('#lc') as SVGGElement | null;
    const ag = root.querySelector('#ag') as SVGCircleElement | null;
    const agt = root.querySelector('#agt') as SVGTextElement | null;
    const lp = root.querySelector('#lp') as SVGPathElement | null;
    const lt = root.querySelector('#lt') as SVGTextElement | null;
    const mg = root.querySelector('#mg') as SVGTextElement | null;
    const m1 = root.querySelector('#m1') as SVGCircleElement | null;
    const m2 = root.querySelector('#m2') as SVGCircleElement | null;

    const dtEl = root.querySelector('#dt');
    const dpEl = root.querySelector('#dp');
    const playBtn = root.querySelector('#pb') as HTMLButtonElement | null;
    const slider = root.querySelector('#sl') as HTMLInputElement | null;
    const tabBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('.epidermis-tab'));

    if (
      !fig ||
      !sv ||
      !cr ||
      !gD ||
      !gL ||
      !bm ||
      !lb ||
      !gMit ||
      !tr ||
      !mt ||
      !gT ||
      !gA ||
      !gM ||
      !gMel ||
      !gMer ||
      !dn ||
      !ms ||
      !rg ||
      !np ||
      !mk1 ||
      !mk2 ||
      !gLangerhans ||
      !lc ||
      !ag ||
      !agt ||
      !lp ||
      !lt ||
      !mg ||
      !m1 ||
      !m2
    ) {
      return;
    }

    const safeFig = fig;
    const safeSv = sv;
    const safeCr = cr;
    const safeGD = gD;
    const safeGL = gL;
    const safeBm = bm;
    const safeLb = lb;
    const safeGMit = gMit;
    const safeTr = tr;
    const safeMt = mt;
    const safeGT = gT;
    const safeGA = gA;
    const safeGM = gM;
    const safeGMel = gMel;
    const safeGMer = gMer;
    const safeDn = dn;
    const safeGMs = ms;
    const safeRg = rg;
    const safeNp = np;
    const safeMk1 = mk1;
    const safeMk2 = mk2;
    const safeGLangerhans = gLangerhans;
    const safeLc = lc;
    const safeAg = ag;
    const safeAgt = agt;
    const safeLp = lp;
    const safeLt = lt;
    const safeMg = mg;
    const safeM1 = m1;
    const safeM2 = m2;

    const LY: [string, number, number, string][] = [
      ['Estrato basal', 250, 290, ''],
      ['Estrato espinoso', 150, 250, ''],
      ['Estrato granuloso', 106, 150, ''],
      ['Estrato lúcido', 92, 106, '(solo piel gruesa)'],
      ['Estrato córneo', 40, 92, ''],
    ];

    const XL = 44;
    let W = 640;
    let LA = 140;
    let XR = 500;
    let TW = 456;
    let mx = 0;
    let rx = 0;
    let mlx = 0;
    let LX = 0;
    let LG: SVGElement[] = [];
    let LT: SVGTextElement[] = [];
    let TR: TracerItem[] = [];
    let built = false;

    // Inicializar dendritas del melanocito
    clearNode(safeDn);
    clearNode(safeGMs);
    const DP = [
      'M150 262Q135 245 118 236',
      'M150 262Q165 245 184 236',
      'M142 275Q128 283 116 277',
      'M158 275Q172 283 184 277',
    ];
    const dps: SVGPathElement[] = [];
    DP.forEach((d) => {
      dps.push(createSvgElement('path', { d }, safeDn) as SVGPathElement);
    });

    const MS: MelanosomeItem[] = [];
    dps.forEach((p, i) => {
      const len = typeof p.getTotalLength === 'function' ? p.getTotalLength() : 50;
      for (let j = 0; j < 3; j++) {
        MS.push({
          e: createSvgElement('circle', { r: 2.3 }, safeGMs),
          p,
          length: len,
          offset: j / 3 + i * 0.17,
        });
      }
    });

    function build(nw: number) {
      W = nw;
      built = true;
      LA = W < 480 ? 112 : 140;
      XR = W - LA;
      TW = XR - XL;

      mx = XL + TW * 0.5;
      rx = XL + TW * 0.74;
      mlx = XL + Math.max(52, TW * 0.27);
      LX = XL + TW * 0.56;

      const flip = rx + 18 + 124 > W - 4;

      safeCr.setAttribute('x', String(XL));
      safeCr.setAttribute('width', String(TW));

      // Dermis adaptable
      clearNode(safeGD);
      createSvgElement('rect', { x: XL, y: 290, width: TW, height: 110, fill: 'var(--der)' }, safeGD);
      createSvgElement(
        'path',
        {
          d: `M${XL} 322Q${(XL + TW * 0.22).toFixed(1)} 306 ${(XL + TW * 0.41).toFixed(1)} 324T${XR} 316M${XL} 366Q${(XL + TW * 0.24).toFixed(1)} 350 ${(XL + TW * 0.54).toFixed(1)} 368T${XR} 358`,
          fill: 'none',
          stroke: 'var(--col)',
          'stroke-width': 3,
        },
        safeGD
      );

      if (!flip) {
        createSvgElement(
          'circle',
          { cx: XL + TW * 0.17, cy: 352, r: 14, fill: '#e88a97', stroke: '#b8505f', 'stroke-width': 2 },
          safeGD
        );
      }
      createSvgElement('path', { d: `M${rx.toFixed(1)} 400V296`, stroke: '#e8c400', 'stroke-width': 2, fill: 'none' }, safeGD);
      safeBm.setAttribute('d', `M${XL} 290H${XR}`);

      // Estratos construidos dinámicamente según el ancho disponible
      clearNode(safeGL);
      LG = [];
      for (let k = 0; k < 5; k++) {
        LG.push(createSvgElement('g', { class: 'g' }, safeGL));
      }

      // Estrato basal
      let n = Math.max(4, Math.round(TW / 27));
      let cw = TW / n;
      for (let k = 0; k < n; k++) {
        const x = XL + k * cw;
        createSvgElement('rect', { x, y: 252, width: cw - 2, height: 36, rx: 7, fill: 'var(--bas)', stroke: 'var(--basl)' }, LG[0]);
        createSvgElement('ellipse', { cx: x + cw / 2 - 1, cy: 272, rx: 6.5, ry: 10, fill: 'var(--nuc)' }, LG[0]);
      }

      // Estrato espinoso
      n = Math.max(3, Math.round(TW / 46));
      cw = TW / n;
      [152, 186, 220].forEach((y, r) => {
        const off = (r % 2) * 0.5 * cw;
        for (let k = 0; k <= n; k++) {
          const x = XL - off + k * cw;
          createSvgElement(
            'rect',
            { x, y, width: cw - 2, height: 32, rx: 12, fill: 'var(--esp)', stroke: 'var(--espl)', 'stroke-dasharray': '2 2' },
            LG[1]
          );
          createSvgElement('ellipse', { cx: x + cw / 2 - 1, cy: y + 16, rx: 8, ry: 7, fill: 'var(--nuc)' }, LG[1]);
        }
      });

      // Estrato granuloso
      n = Math.max(3, Math.round(TW / 56));
      cw = TW / n;
      [108, 129].forEach((y, r) => {
        const off = (r % 2) * 0.5 * cw;
        for (let k = 0; k <= n; k++) {
          const x = XL - off + k * cw;
          createSvgElement(
            'rect',
            { x, y, width: cw - 2, height: 19, rx: 6, fill: 'var(--gra)', stroke: 'var(--gral)' },
            LG[2]
          );
          createSvgElement('ellipse', { cx: x + cw / 2 - 1, cy: y + 9.5, rx: 6, ry: 4, fill: 'var(--nuc)' }, LG[2]);
          [[0.17, 5], [0.33, 14], [0.7, 6], [0.85, 13]].forEach((d) => {
            createSvgElement('circle', { cx: x + cw * d[0], cy: y + d[1], r: 1.7, fill: 'var(--gran)' }, LG[2]);
          });
        }
      });

      // Estrato lúcido
      createSvgElement('rect', { x: XL, y: 92, width: TW, height: 14, fill: 'var(--luc)' }, LG[3]);

      // Estrato córneo
      n = Math.max(3, Math.round(TW / 60));
      cw = TW / n;
      for (let i = 0; i < 6; i++) {
        const off = (i % 2) * 0.5 * cw;
        for (let k = 0; k <= n; k++) {
          createSvgElement(
            'rect',
            { x: XL - off + k * cw, y: 42 + i * 8.5, width: cw - 2, height: 7.5, rx: 3, fill: 'var(--cor)', stroke: 'var(--corl)' },
            LG[4]
          );
        }
      }

      // Etiquetas de estratos en el margen derecho
      clearNode(safeLb);
      LT = [];
      LY.forEach((l) => {
        const m = (l[1] + l[2]) / 2;
        const tx = createSvgElement('text', { x: XR + 14, y: m + (l[3] ? 0 : 4), class: 'layer-title' }, safeLb) as SVGTextElement;
        tx.textContent = l[0];
        LT.push(tx);

        if (l[3]) {
          const s2 = createSvgElement('text', { x: XR + 14, y: m + 12, class: 'layer-sub', style: 'font-size:10px;' }, safeLb);
          s2.textContent = l[3];
        }
        createSvgElement('path', { d: `M${XR} ${m}H${XR + 9}`, class: 'l' }, safeLb);
      });

      const tm = createSvgElement('text', { x: XR + 14, y: 296, class: 'layer-sub', style: 'font-size:10px;' }, safeLb);
      tm.textContent = 'Membrana basal';
      const td = createSvgElement('text', { x: XR + 14, y: 340, class: 'b', style: 'font-weight:700' }, safeLb);
      td.textContent = 'Dermis';

      // Paso 2: mitosis y queratinocitos trazadores
      safeGMit.setAttribute('transform', `translate(${(mx - 237).toFixed(1)},0)`);
      safeMt.setAttribute('x', String(mx.toFixed(1)));

      clearNode(safeTr);
      TR = [];
      let c = 0;
      for (let cx = XL + 36; cx < XR - 22; cx += 62) {
        if (Math.abs(cx - mx) < 46) continue;
        const gg = createSvgElement('g', {}, safeTr);
        TR.push({
          g: gg,
          b: createSvgElement('ellipse', { stroke: 'var(--acc)', 'stroke-width': 2 }, gg),
          n: createSvgElement('ellipse', { fill: 'var(--nuc)' }, gg),
          cx,
          o: (c++ * 0.382) % 1,
        });
      }

      // Paso 3: melanocito y célula de Merkel
      safeGMel.setAttribute('transform', `translate(${(mlx - 150).toFixed(1)},0)`);
      safeGMer.setAttribute('transform', `translate(${(rx - 330).toFixed(1)},0)`);

      const anchor = flip ? 'end' : 'start';
      const labelX = flip ? 312 : 348;
      safeMk1.setAttribute('text-anchor', anchor);
      safeMk1.setAttribute('x', String(labelX));
      safeMk1.setAttribute('y', flip ? '338' : '312');

      safeMk2.setAttribute('text-anchor', anchor);
      safeMk2.setAttribute('x', String(labelX));
      safeMk2.setAttribute('y', flip ? '350' : '324');

      // Paso 4: Célula de Langerhans y antígeno
      const right = LX + 60 + 118 <= W - 4;
      if (right) {
        safeLp.setAttribute('d', `M${(LX + 14).toFixed(1)} 198L${(LX + 58).toFixed(1)} 184`);
        safeLt.setAttribute('x', String((LX + 60).toFixed(1)));
        safeLt.setAttribute('y', '188');
        safeLt.setAttribute('text-anchor', 'start');
      } else {
        safeLp.setAttribute('d', '');
        safeLt.setAttribute('x', String(clamp(LX, XL + 62, XR - 62).toFixed(1)));
        safeLt.setAttribute('y', '240');
        safeLt.setAttribute('text-anchor', 'middle');
      }

      safeAgt.setAttribute('x', String((LX + 12).toFixed(1)));
      safeMg.setAttribute('x', String(clamp(LX, XL + 90, W - 90).toFixed(1)));

      draw();
    }

    let t = 0;
    let clk = 0;
    let play = true;
    let last = 0;
    let cur = -1;
    let drag = false;
    let rafId: number | null = null;

    const op: [number, number, number, number][] = [
      [0, 0, 0, 0],
      [1, 0, 0, 1],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
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

        safeGT.style.opacity = String(op[st][0]);
        safeGM.style.opacity = String(op[st][1]);
        safeGLangerhans.style.opacity = String(op[st][2]);
        safeGA.style.opacity = String(op[st][3]);
        safeMt.style.opacity = st === 1 ? '1' : '0';
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

      const act = Math.min(4, Math.floor(fr * 5));
      LG.forEach((g, i) => {
        const o = st === 0 ? (i === act ? 1 : 0.3) : st === 1 ? 0.85 : st === 2 ? (i === 0 ? 1 : 0.5) : (i === 1 ? 1 : 0.5);
        g.style.opacity = String(o);
        if (LT[i]) {
          LT[i].style.opacity = String(o);
          LT[i].style.fontWeight = st === 0 && i === act ? '700' : '500';
        }
      });
    }

    function anim() {
      // Mitosis en estrato basal
      const d = 3 + 6 * (0.5 + 0.5 * Math.sin(clk * 1.3));
      safeM1.setAttribute('cx', String(237 - d));
      safeM2.setAttribute('cx', String(237 + d));

      // Queratinocitos trazadores en ascenso
      TR.forEach((q) => {
        const p = (clk * 0.09 + q.o) % 1;
        const y = 270 - p * 204;
        const rx_ = 11 + p * 15;
        const ry = 15 - p * 11;
        const f = p < 0.2 ? 'var(--bas)' : p < 0.6 ? 'var(--esp)' : p < 0.8 ? 'var(--gra)' : 'var(--cor)';
        const ds = p > 0.92 ? (p - 0.92) / 0.08 : 0;
        const o = p < 0.04 ? p / 0.04 : 1 - ds;

        q.g.setAttribute('transform', `translate(${q.cx + ds * 14},${y})`);
        q.g.setAttribute('opacity', String(o));
        q.b.setAttribute('rx', String(rx_));
        q.b.setAttribute('ry', String(ry));
        q.b.setAttribute('fill', f);
        q.n.setAttribute('rx', String(7 * (1 - p * 0.6)));
        q.n.setAttribute('ry', String(Math.max(0.1, 9 * (1 - p * 0.9))));
        q.n.setAttribute('opacity', String(Math.max(0, Math.min(1, (0.78 - p) * 10))));
      });

      // Melanosomas a lo largo de las prolongaciones dendríticas
      MS.forEach((m) => {
        if (typeof m.p.getPointAtLength === 'function') {
          const pt = m.p.getPointAtLength(((clk * 0.35 + m.offset) % 1) * m.length);
          m.e.setAttribute('cx', String(pt.x));
          m.e.setAttribute('cy', String(pt.y));
        }
      });

      // Mecanorreceptor de Merkel (ondas de tacto)
      const rr = 14 + (clk * 22) % 20;
      safeRg.setAttribute('r', String(rr));
      safeRg.setAttribute('opacity', String(1 - (rr - 14) / 20));

      // Impulsos nerviosos descendentes de la célula de Merkel
      safeNp.setAttribute('cy', String(294 + (clk * 40) % 100));

      // Célula de Langerhans y antígeno
      const ph = (clk / 9) % 1;
      let dy = 0;
      let ay = 36;
      let ax = LX;
      let ar = 4.5;
      let av = 1;

      if (ph < 0.35) {
        ay = 36 + (ph / 0.35) * 104;
      } else if (ph < 0.5) {
        const u = (ph - 0.35) / 0.15;
        ay = 140 + u * 60;
        ax = LX - 2 * u;
        ar = 4.5 * (1 - 0.7 * u);
      } else {
        av = 0;
        ay = 200;
        dy = Math.min(1, (ph - 0.5) / 0.35) * 125;
      }

      const lo = ph < 0.04 ? ph / 0.04 : ph > 0.85 ? 1 - (ph - 0.85) / 0.15 : 1;
      safeAg.setAttribute('cx', String(ax));
      safeAg.setAttribute('cy', String(ay));
      safeAg.setAttribute('r', String(ar));
      safeAg.setAttribute('opacity', String(av));
      safeLc.setAttribute('transform', `translate(${LX - 260},${dy})`);
      safeLc.setAttribute('opacity', String(lo));
      safeAgt.setAttribute('opacity', ph < 0.25 ? '1' : '0');
      safeMg.setAttribute('opacity', ph > 0.5 && ph < 0.9 ? '1' : '0');
    }

    function loop(ts: number) {
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;
      if (play || drag) clk += dt;

      if (play && !drag) {
        t += dt * 1000;
        if (t >= T_TOTAL) t = 0;
      }

      draw();
      anim();
      rafId = requestAnimationFrame(loop);
    }

    // Adaptación reactiva continua al ancho del contenedor
    let pend = false;
    function fit() {
      pend = false;
      const w = safeFig.clientWidth;
      const h = safeFig.clientHeight;
      const nw = w && h ? Math.max(300, Math.round((400 * w) / h)) : 640;
      safeSv.setAttribute('viewBox', `0 0 ${nw} 400`);
      if (nw !== W || !built) {
        build(nw);
      }
    }

    function reqFit() {
      if (!pend) {
        pend = true;
        requestAnimationFrame(fit);
      }
    }

    fit();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof window !== 'undefined' && 'ResizeObserver' in window) {
      resizeObserver = new ResizeObserver(reqFit);
      resizeObserver.observe(safeFig);
    }
    window.addEventListener('resize', reqFit);

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
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', reqFit);
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
      className={`home-histology-fact epidermis-fact ${className}`}
      aria-label="Dato histológico de la semana: Epidermis"
    >
      <span className="epidermis-fact-shine" aria-hidden="true" />
      <span className="epidermis-fact-glow epidermis-fact-glow-cyan" aria-hidden="true" />
      <span className="epidermis-fact-glow epidermis-fact-glow-violet" aria-hidden="true" />
      <span className="home-histology-fact-mesh" aria-hidden="true" />

      <div className="epidermis-grid">
        <div className="epidermis-left">
          <div className="epidermis-top">
            <span className="epidermis-badge">
              <Microscope size={13} className="epidermis-badge-icon" />
              <span>{badgeLabel.toUpperCase()}</span>
            </span>
          </div>

          <div className="epidermis-header">
            <h2>Epidermis</h2>
            <p className="sub">Cinco estratos y cuatro poblaciones celulares: del estrato basal a la descamación.</p>
          </div>

          <div className="epidermis-desc">
            <h3 id="dt">{STAGES[0].title}</h3>
            <p id="dp">{STAGES[0].desc}</p>
          </div>

          <div className="epidermis-tabs" role="tablist" aria-label="Estratos y poblaciones celulares">
            {STAGES.map((s, i) => (
              <button
                key={s.title}
                type="button"
                role="tab"
                className={`epidermis-tab ${i === 0 ? 'on' : ''}`}
                aria-label={`Etapa ${i + 1}: ${s.title}`}
              >
                <small>{i + 1}</small>
                <b>{s.title}</b>
                <i style={{ width: i === 0 ? '0%' : '0%' }} />
              </button>
            ))}
          </div>

          <div className="epidermis-ctl">
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
              aria-label="Progreso de la animación de epidermis"
            />
          </div>

          <div className="epidermis-leg" aria-label="Leyenda celular">
            <span style={{ ['--c' as string]: 'var(--esp)' }}>Queratinocito</span>
            <span style={{ ['--c' as string]: '#8a5a2b' }}>Melanocito</span>
            <span style={{ ['--c' as string]: '#2fa39a' }}>Célula de Merkel</span>
            <span style={{ ['--c' as string]: '#7a5cc7' }}>Célula de Langerhans</span>
          </div>
        </div>

        {/* ─── Figura SVG dinámica adaptable al 100% de cualquier pantalla ─── */}
        <div className="epidermis-fig" id="fig">
          <svg
            id="sv"
            viewBox="0 0 640 400"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label="Corte de la epidermis con sus estratos y poblaciones celulares"
          >
            <defs>
              <clipPath id="cp">
                <rect id="cr" x="44" y="0" width="400" height="400" />
              </clipPath>
            </defs>
            <g id="gD" />
            <g id="L" clipPath="url(#cp)" />
            <path id="bm" d="" stroke="var(--bm)" strokeWidth="3" fill="none" />
            <g id="lb" />
            <g id="gT" className="g" opacity="0" clipPath="url(#cp)">
              <g id="gMit">
                <ellipse cx="237" cy="272" rx="15" ry="15" fill="none" stroke="var(--acc)" strokeWidth="1.5" strokeDasharray="3 3" />
                <circle id="m1" cy="272" r="4" fill="#7a2d9a" />
                <circle id="m2" cy="272" r="4" fill="#7a2d9a" />
              </g>
              <g id="tr" />
            </g>
            <text id="mt" y="312" textAnchor="middle" className="h" opacity="0">
              Mitosis
            </text>
            <g id="gA" className="g" opacity="0">
              <path d="M24 285V60" stroke="var(--acc)" strokeWidth="2" fill="none" />
              <path d="M18 70L24 56L30 70Z" fill="var(--acc)" />
              <text transform="translate(12 175) rotate(-90)" textAnchor="middle" style={{ fill: 'var(--acc)', fontWeight: 700 }}>
                ≈ 28 días hasta descamarse
              </text>
            </g>
            <g id="gM" className="g" opacity="0">
              <g id="gMel">
                <g id="dn" fill="none" stroke="#8a5a2b" strokeWidth="3" strokeLinecap="round" />
                <ellipse cx="150" cy="272" rx="11" ry="14" fill="#f0dcc0" stroke="#8a5a2b" strokeWidth="1.5" />
                <ellipse cx="150" cy="274" rx="6" ry="8" fill="#8a6a8a" />
                <ellipse cx="123" cy="257" rx="6" ry="2.6" fill="#5a3416" />
                <ellipse cx="178" cy="257" rx="6" ry="2.6" fill="#5a3416" />
                <g id="ms" fill="#5a3416" />
                <path className="l" d="M150 286V302" />
                <text x="150" y="314" textAnchor="middle" className="h">
                  Melanocito
                </text>
              </g>
              <g id="gMer">
                <circle id="rg" cx="330" cy="271" fill="none" stroke="#2fa39a" strokeWidth="2" />
                <rect x="319" y="289" width="22" height="5" rx="2" fill="#e8c400" />
                <ellipse cx="330" cy="271" rx="11" ry="14" fill="#2fa39a" />
                <ellipse cx="330" cy="272" rx="6" ry="8" fill="#145e58" />
                <circle id="np" cx="330" r="2.6" fill="#e8c400" />
                <text id="mk1" className="h">
                  Célula de Merkel
                </text>
                <text id="mk2" style={{ fontSize: '10px' }}>
                  + terminación nerviosa
                </text>
              </g>
            </g>
            <g id="gL" className="g" opacity="0">
              <g id="lc">
                <g fill="none" stroke="#7a5cc7" strokeWidth="3" strokeLinecap="round">
                  <path d="M252 195Q235 175 226 150M268 195Q285 172 298 152M250 205Q232 215 220 206M270 206Q288 218 300 208M260 191Q258 170 262 140" />
                </g>
                <ellipse cx="260" cy="200" rx="12" ry="9" fill="#7a5cc7" />
                <ellipse cx="260" cy="200" rx="6" ry="5" fill="#3f2a8a" />
              </g>
              <circle id="ag" r="4.5" fill="#f2a13a" />
              <text id="agt" y="52" className="h">
                Antígeno
              </text>
              <path id="lp" className="l" d="" />
              <text id="lt" className="h">
                Célula de Langerhans
              </text>
              <text id="mg" y="372" textAnchor="middle" className="h">
                → migra a la dermis y al ganglio
              </text>
            </g>
          </svg>
        </div>
      </div>
    </section>
  );
};

export default HomeHistologyFact;
