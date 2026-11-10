import { useId } from 'react';
import { ScanEye } from 'lucide-react';
import lightbulbIcon from '../assets/icons/bombilla.ico';
import '../styles/weeklyHistology.css';
import '../styles/weeklyHistologyFacts.css';

export type WeeklyHistologyFact = {
  topic: string;
  title: string;
  description: string;
  clue: string;
  illustration: 'liver' | 'henle';
};

const WEEKLY_FACTS: [WeeklyHistologyFact, WeeklyHistologyFact] = [
  {
    topic: 'Tema 03 · Tercer parcial',
    title: 'Tres formas de ver el hígado',
    description: 'El lobulillo clásico es hexagonal y muestra cómo la sangre converge en la vena central. El lobulillo portal es triangular y agrupa el tejido que drena bilis hacia un mismo conducto biliar. El acino hepático es romboidal y distingue tres zonas según la distancia al aporte de sangre.',
    clue: 'En la placa, ubica una vena central y un espacio porta. La zona 1 del acino recibe primero la sangre y la zona 3 queda junto a la vena central.',
    illustration: 'liver',
  },
  {
    topic: 'Tema 04 · Tercer parcial',
    title: 'Asas de Henle largas para ahorrar agua',
    description: 'En el dromedario, muchas asas de Henle son largas y penetran profundamente en la médula renal. Ayudan a establecer un gradiente de concentración que permite recuperar agua en los conductos colectores y producir una orina más concentrada.',
    clue: 'Sigue la rama descendente hacia la médula y luego la ascendente de vuelta hacia la corteza.',
    illustration: 'henle',
  },
];

function TissueSketch({ kind }: { kind: WeeklyHistologyFact['illustration'] }) {
  const id = useId();
  if (kind === 'liver') {
    const hexagon = 'M0 -51L44 -26V26L0 51L-44 26V-26Z';

    return (
      <svg viewBox="0 0 480 200" role="img" aria-label="Tres vistas del tejido hepático: lobulillo clásico, lobulillo portal y acino con tres zonas">
        <defs>
          <radialGradient id={`${id}-field`} cx=".48" cy=".43" r=".72">
            <stop stopColor="#713f69" />
            <stop offset=".62" stopColor="#41263f" />
            <stop offset="1" stopColor="#211629" />
          </radialGradient>
          <pattern id={id} width="31" height="25" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)">
            <path d="M2 7Q1 2 7 1Q14 0 15 6L13 11Q8 15 3 12ZM17 4Q23 1 28 5L30 12Q27 16 22 15L17 12ZM8 15Q15 12 20 17L19 23Q13 26 7 22Z" fill="#dd8eaa" fillOpacity=".18" stroke="#f7afcf" strokeOpacity=".37" />
            <g fill="#ef9cc9" opacity=".7">
              <ellipse cx="8" cy="7" rx="2.4" ry="1.6" />
              <ellipse cx="24" cy="9" rx="1.7" ry="2.3" />
              <ellipse cx="13" cy="19" rx="2.1" ry="1.5" />
            </g>
          </pattern>
        </defs>
        <rect width="480" height="200" fill="#2c193c" />
        <path d="M0 20H480M0 155H480" stroke="#bd7bb1" opacity=".35" />
        <g fill={`url(#${id}-field)`} stroke="#ad77a0">
          <rect x="14" y="30" width="141" height="117" rx="12" />
          <rect x="170" y="30" width="140" height="117" rx="12" />
          <rect x="325" y="30" width="141" height="117" rx="12" />
        </g>
        <g fill={`url(#${id})`}>
          <rect x="15" y="31" width="139" height="115" rx="11" />
          <rect x="171" y="31" width="138" height="115" rx="11" />
          <rect x="326" y="31" width="139" height="115" rx="11" />
        </g>
        <g transform="translate(84 88)">
          <path d={hexagon} fill="#be68aa" fillOpacity=".46" stroke="#ffc8ea" strokeWidth="2" />
          <g fill="none" stroke="#ffd3eb" strokeLinecap="round">
            {[0, 60, 120, 180, 240, 300].map((angle) => (
              <g key={angle} transform={`rotate(${angle})`}>
                <path d="M0-45Q-4-30 0-13M-15-33Q-12-22-5-11M15-33Q12-22 5-11" opacity=".5" />
                <path d="M-3-21L0-17L3-21" strokeWidth="1.5" />
              </g>
            ))}
          </g>
          <circle r="10" fill="#693f8d" stroke="#fce0ff" strokeWidth="3" />
          <g fill="#8cf2d8">
            <circle cy="-51" r="3" /><circle cy="51" r="3" />
            <circle cx="-44" cy="-26" r="3" /><circle cx="-44" cy="26" r="3" />
            <circle cx="44" cy="-26" r="3" /><circle cx="44" cy="26" r="3" />
          </g>
        </g>
        <g transform="translate(240 88)">
          <path d="M0-48L51 38H-51Z" fill="#329d91" fillOpacity=".44" stroke="#9df7df" strokeWidth="2" />
          <path d="M0-35V-14M-39 30L-13 10M39 30L13 10M-4-20L0-14L4-20M-20 10L-13 10L-14 17M20 10L13 10L14 17" fill="none" stroke="#b0ffe7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <g fill="#693f8d" stroke="#fce0ff" strokeWidth="2">
            <circle cy="-48" r="5" /><circle cx="-51" cy="38" r="5" /><circle cx="51" cy="38" r="5" />
          </g>
          <circle r="8" fill="#0f5e54" stroke="#b0ffe7" strokeWidth="3" />
        </g>
        <g transform="translate(395 88)">
          <path d="M-60 0L0-40L60 0L0 40Z" fill="#9872b5" stroke="#f7dcff" strokeWidth="2" />
          <path d="M-39 0L0-40L39 0L0 40Z" fill="#cf8ac1" />
          <path d="M-19 0L0-40L19 0L0 40Z" fill="#ffc4b7" />
          <circle cx="-60" r="5" fill="#693f8d" stroke="#fce0ff" strokeWidth="2" />
          <circle cx="60" r="5" fill="#693f8d" stroke="#fce0ff" strokeWidth="2" />
          <g fill="#301941" textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="700">
            <text x="0" y="0">1</text><text x="29" y="0">2</text><text x="47" y="0">3</text>
          </g>
        </g>
        <g fill="#ffedf8" textAnchor="middle" fontSize="16" fontWeight="600">
          <text x="84" y="180">Clásico</text>
          <text x="240" y="180">Portal</text>
          <text x="395" y="180">Acino</text>
        </g>
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 480 200" role="img" aria-label="Una escena del desierto acompaña el esquema del asa de Henle del dromedario. El asa desciende de la corteza a la médula profunda y vuelve a subir.">
      <defs>
        <linearGradient id={id} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop stopColor="#ffe1ab" />
          <stop offset="1" stopColor="#bd655b" />
        </linearGradient>
        <linearGradient id={`${id}-medulla`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop stopColor="#614359" />
          <stop offset=".48" stopColor="#493452" />
          <stop offset="1" stopColor="#26213f" />
        </linearGradient>
      </defs>
      <rect width="480" height="200" fill={`url(#${id})`} />
      <circle cx="91" cy="56" r="42" fill="#fff0c6" opacity=".24" />
      <circle cx="91" cy="56" r="33" fill="#fff0c6" />
      <path d="M0 121Q74 81 141 119T280 117V200H0Z" fill="#e0a16f" />
      <path d="M0 164Q77 116 147 149T276 144V200H0Z" fill="#a85255" />
      <path d="M0 182Q93 152 198 184V200H0Z" fill="#693547" />
      <g fill="none" stroke="#ffe1ab" strokeLinecap="round" opacity=".48">
        <path d="M15 125Q44 113 66 113M25 131Q42 124 56 123M107 169Q137 162 168 170M127 174Q151 169 177 176M18 184Q39 179 60 180" />
      </g>
      <g fill="#4e2b3e" stroke="#4e2b3e" strokeLinecap="round" strokeLinejoin="round">
        <path d="M45 126Q53 124 62 111Q74 86 88 105L104 120Q116 119 122 105L133 84Q137 77 146 81L156 86L152 92L141 91L135 122Q132 141 114 144L70 143Q54 141 45 126Z" />
        <path d="M61 137L57 154L59 169M76 141L72 160L74 171M112 141L119 154L118 169M122 139L132 151L133 165" fill="none" strokeWidth="5" />
        <path d="M48 127Q39 132 42 147" fill="none" strokeWidth="3" />
      </g>
      <rect x="186" y="13" width="281" height="174" rx="13" fill={`url(#${id}-medulla)`} stroke="#f5d1b7" strokeOpacity=".7" />
      <path d="M187 56H466M187 97H466M187 139H466" stroke="#f9d6df" strokeOpacity=".29" strokeDasharray="4 5" />
      <path d="M403 48V160M399 155L403 161L407 155" fill="none" stroke="#efd3e9" strokeOpacity=".65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="425" y="104" transform="rotate(90 425 104)" textAnchor="middle" fill="#fff0e7" fontSize="13">Profundidad</text>
      <path d="M316 42V143a28 28 0 0 0 56 0V42" fill="none" stroke="#f6d0bd" strokeOpacity=".24" strokeWidth="18" strokeLinecap="round" />
      <path d="M316 42V143a28 28 0 0 0 56 0" fill="none" stroke="#81e6e0" strokeWidth="7" strokeLinecap="round" />
      <path d="M372 143V42" stroke="#ffc08d" strokeWidth="7" strokeLinecap="round" />
      <path d="M307 78l9 10 9-10M363 107l9-10 9 10" fill="none" stroke="#fff4e5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#fff0e7" fontSize="15" fontWeight="600">
        <text x="201" y="43">Corteza</text>
        <text x="201" y="113">Médula</text>
        <text x="201" y="132">profunda</text>
      </g>
    </svg>
  );
}

export default function WeeklyHistologyFacts({ facts = WEEKLY_FACTS }: { facts?: [WeeklyHistologyFact, WeeklyHistologyFact] }) {
  return <section className="weekly-facts" aria-labelledby="weekly-facts-title">
    <header className="weekly-facts__header">
      <span className="weekly-facts__icon" aria-hidden="true"><img src={lightbulbIcon} alt="" /></span>
      <h2 id="weekly-facts-title">Datos histológicos de la semana</h2>
    </header>
    <div className="weekly-facts__grid">{facts.map((fact, index) => <article key={index} className={`weekly-fact weekly-fact--${fact.illustration}`}>
      <div className="weekly-fact__top"><span className="weekly-fact__topic">{fact.topic}</span></div>
      <div className="weekly-fact__art"><TissueSketch kind={fact.illustration} /></div>
      <div className="weekly-fact__body"><h3>{fact.title}</h3><p>{fact.description}</p></div>
      <div className="weekly-fact__clue"><ScanEye size={19} aria-hidden="true" /><p>{fact.clue}</p></div>
    </article>)}</div>
  </section>;
}
