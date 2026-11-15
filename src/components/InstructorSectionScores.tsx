import { formatInstructorPoints, type InstructorSectionResult } from '../types/instructorQuestions';

export default function InstructorSectionScores({ sections }: { sections?: InstructorSectionResult[] }) {
  if (!sections?.length) return null;
  return <section className="instructor-section-scores" aria-label="Calificación por tema"><h3>Calificación por tema</h3>
    <div className="instructor-score-table"><table><thead><tr><th>Tema</th><th>Puntos</th><th>Estado</th></tr></thead><tbody>
      {sections.map(section => <tr key={section.id}><th scope="row">{section.nombre}</th><td>{formatInstructorPoints(section.correct)} de {section.total}</td>
        <td>{section.pending_review ? `Provisional · ${section.pending_review} por revisar` : `${section.percentage}% · Revisada`}</td></tr>)}
    </tbody></table></div>
  </section>;
}
