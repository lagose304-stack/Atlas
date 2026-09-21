import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Microscope, Pause, Play, Sparkles } from 'lucide-react';
import '../styles/homeHistologyFact.css';

const LOOP_DURATION = 18_000;
const STAGES = [
  { title: 'Rodamiento', description: 'Las selectinas del endotelio frenan al leucocito. Sus uniones breves hacen que ruede sobre la pared del vaso.' },
  { title: 'Adhesión firme', description: 'Las quimiocinas activan integrinas; entonces el leucocito se adhiere con firmeza a las moléculas ICAM-1.' },
  { title: 'Diapédesis', description: 'El leucocito cambia de forma, atraviesa el espacio entre células endoteliales y cruza la membrana basal.' },
  { title: 'Migración al foco', description: 'En el tejido, sigue el gradiente de quimiocinas hasta el foco de infección.' },
];

const stageForProgress = (progress: number) => Math.min(3, Math.floor(progress * 4));
function leucocytePosition(progress: number) {
  const stage = stageForProgress(Math.min(progress, 0.999));
  const local = (progress - stage / 4) * 4;
  if (stage === 0) return { x: 170 + local * 250, y: 155, scaleX: 1, scaleY: 1 };
  if (stage === 1) return { x: 420, y: 164, scaleX: 1.28, scaleY: 0.76 };
  if (stage === 2) return { x: 470, y: 165 + local * 128, scaleX: 0.82, scaleY: 1.25 };
  return { x: 475 + local * 315, y: 293 + Math.sin(local * Math.PI) * 92 + local * 82, scaleX: 1.1, scaleY: 0.88 };
}

export const HomeHistologyFact: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(true);
  const stage = stageForProgress(Math.min(progress, 0.999));
  const activeStage = STAGES[Math.min(stage, STAGES.length - 1)] ?? STAGES[0];
  const position = useMemo(() => leucocytePosition(progress), [progress]);

  useEffect(() => {
    if (!playing) return undefined;
    let previous = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      setProgress((value) => {
        const nextValue = Number.isFinite(value) ? value : 0;
        const increment = (now - previous) / LOOP_DURATION;
        return (nextValue + increment) % 1;
      });
      previous = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  const selectStage = (index: number) => { setProgress(Math.min(1, Math.max(0, index / 4 + 0.005))); setPlaying(false); };

  return (
    <section className="home-histology-fact home-reveal diapedesis-fact" aria-labelledby="home-histology-fact-title">
      <span className="home-fact-shine" aria-hidden="true" />
      <span className="home-fact-glow home-fact-glow-cyan" aria-hidden="true" />
      <span className="home-histology-fact-mesh" aria-hidden="true" />
      <div className="diapedesis-heading">
        <div className="home-histology-fact-brand">
          <div className="home-histology-fact-icon" aria-hidden="true"><Microscope size={18} /></div>
          <span className="home-histology-fact-label"><Sparkles size={13} /> Dato histológico de la semana</span>
        </div>
        <div><h2 id="home-histology-fact-title">Diapédesis</h2><p>Cómo un leucocito sale del vaso sanguíneo y llega al tejido infectado.</p></div>
      </div>
      <div className="diapedesis-frame">
        <svg className="diapedesis-scene" viewBox="0 0 900 480" role="img" aria-label="Esquema animado de la diapédesis de un leucocito">
          <defs><radialGradient id="infectionGlow"><stop stopColor="#a23f9a" stopOpacity=".34" /><stop offset="1" stopColor="#a23f9a" stopOpacity="0" /></radialGradient><filter id="softGlow"><feGaussianBlur stdDeviation="7" /></filter></defs>
          <rect width="900" height="480" fill="#f0eaf0" /><rect width="900" height="205" fill="#fce8e2" />
          <g className="diapedesis-fibers" fill="none"><path d="M0 305 C120 270 215 342 365 305 S665 338 900 298" /><path d="M0 385 C150 420 278 345 455 380 S715 405 900 355" /><path d="M0 440 C130 405 280 460 470 420 S700 450 900 420" /></g>
          <g className="diapedesis-rbc" aria-hidden="true"><ellipse cx="92" cy="60" rx="14" ry="7" /><ellipse cx="235" cy="105" rx="14" ry="7" /><ellipse cx="575" cy="64" rx="14" ry="7" /><ellipse cx="742" cy="118" rx="14" ry="7" /></g>
          <g className="diapedesis-endothelium">{[[-15, 120], [135, 290], [305, 455], [485, 635], [650, 800], [815, 920]].map(([x, end]) => <rect key={x} x={x} y="199" width={end - x} height="28" rx="10" />)}</g>
          <g className="diapedesis-selectins">{[160, 205, 250, 345, 390, 535, 580, 685, 730].map((x) => <g key={x}><line x1={x} y1="199" x2={x} y2="175" /><circle cx={x} cy="172" r="4" /></g>)}</g>
          <g className="diapedesis-icam">{[178, 225, 275, 360, 410, 550, 605, 705, 760].map((x) => <g key={x}><line x1={x} y1="199" x2={x} y2="185" /><circle cx={x} cy="182" r="3.5" /></g>)}</g>
          <path className="diapedesis-basal" d="M0 236 H445 M495 236 H900" />
          <g className="diapedesis-chemokines" aria-hidden="true">{[[555, 344], [615, 368], [678, 355], [730, 397], [766, 374]].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={4 + i % 2} />)}</g>
          <circle cx="824" cy="407" r="105" fill="url(#infectionGlow)" filter="url(#softGlow)" />
          <g className="diapedesis-bacteria">{[[806, 405, -25], [835, 390, 30], [849, 420, -48], [814, 431, 70], [870, 405, 10]].map(([x, y, rotation], i) => <rect key={i} x={x - 10} y={y - 4} width="20" height="8" rx="4" transform={`rotate(${rotation} ${x} ${y})`} />)}</g>
          <g className="diapedesis-leukocyte" transform={`translate(${position.x} ${position.y}) scale(${position.scaleX} ${position.scaleY})`}><circle r="31" /><path d="M-13 -8 C-20 2 -10 13 1 6 C7 17 22 12 17 -2 C24 -14 8 -20 -2 -11 C-7 -20 -19 -17 -13 -8" /></g>
          <g className="diapedesis-labels"><text x="16" y="28">Luz del vaso</text><text x="16" y="217">Endotelio</text><text x="16" y="258">Membrana basal</text><text x="16" y="290">Tejido</text><text x="752" y="466">Foco de infección</text></g>
        </svg>
      </div>
      <div className="diapedesis-controls"><button type="button" className="diapedesis-play" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pausar animación' : 'Reproducir animación'}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}{playing ? 'Pausar' : 'Reproducir'}</button><input type="range" min="0" max="1000" value={Math.round(progress * 1000)} onChange={(event) => {
        const nextProgress = Number(event.target.value);
        if (!Number.isFinite(nextProgress)) return;
        setProgress(Math.min(1, Math.max(0, nextProgress / 1000)));
        setPlaying(false);
      }} aria-label="Progreso de la animación" aria-valuetext={activeStage.title} /></div>
      <ol className="diapedesis-steps">{STAGES.map((item, index) => <li key={item.title}><button type="button" className={stage === index ? 'is-current' : ''} aria-current={stage === index ? 'step' : undefined} onClick={() => selectStage(index)}><span>{index + 1}</span><strong>{item.title}</strong><ChevronRight size={14} /></button></li>)}</ol>
      <div className="diapedesis-detail" aria-live="polite"><h3>{activeStage.title}</h3><p>{activeStage.description}</p></div>
      <ul className="diapedesis-legend" aria-label="Leyenda"><li><i className="leukocyte" />Leucocito</li><li><i className="selectin" />Selectinas</li><li><i className="icam" />ICAM-1 e integrinas</li><li><i className="chemokine" />Quimiocinas</li></ul>
    </section>
  );
};

export default HomeHistologyFact;
