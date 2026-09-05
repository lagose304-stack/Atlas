import React from 'react';
import { Brain, CalendarDays, Eye, Microscope } from 'lucide-react';

export interface HomeSemesterWelcomeProps {
  periodText?: string;
  titlePrefix?: string;
  titleEmphasis?: string;
  description?: string;
  periodEmblem?: string;
  yearEmblem?: string;
}

/**
 * Componente archivado: "Bienvenidos al Laboratorio de Histología"
 * Guardado para su reutilización futura cuando finalicen periodos de exámenes
 * o al iniciar un nuevo ciclo académico.
 */
export const HomeSemesterWelcome: React.FC<HomeSemesterWelcomeProps> = ({
  periodText = 'II PAC · 2026',
  titlePrefix = 'Bienvenidos al',
  titleEmphasis = 'Laboratorio de Histología',
  description = 'Comenzamos un nuevo período para observar, identificar y comprender los tejidos que construyen el cuerpo humano.',
  periodEmblem = 'II',
  yearEmblem = 'PAC 2026',
}) => {
  return (
    <section className="home-semester-welcome home-reveal" aria-labelledby="home-welcome-title">
      <span className="home-welcome-glow home-welcome-glow-one" aria-hidden="true" />
      <span className="home-welcome-glow home-welcome-glow-two" aria-hidden="true" />

      <div className="home-welcome-copy">
        <span className="home-welcome-badge"><CalendarDays size={15} /> {periodText}</span>
        <h1 id="home-welcome-title">{titlePrefix}<br /><em>{titleEmphasis}</em></h1>
        <p>{description}</p>
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
          <strong>{periodEmblem}</strong>
          <span>{yearEmblem}</span>
        </div>
        <span className="home-emblem-dot home-emblem-dot-one" />
        <span className="home-emblem-dot home-emblem-dot-two" />
        <span className="home-emblem-dot home-emblem-dot-three" />
      </div>
    </section>
  );
};

export default HomeSemesterWelcome;
