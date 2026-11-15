import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpenCheck, FileCheck2, KeyRound, Layers3 } from 'lucide-react';
import { publicInstructorTests, type PublicInstructorSummary } from '../services/instructorTests';
import '../styles/instructorTests.css';
import '../styles/instructorPublic.css';
import { formatInstructorSchedule } from '../hooks/useInstructorAvailability';

export default function PublicInstructorTests({ reloadKey = 0 }: { reloadKey?: number }) {
  const [tests, setTests] = useState<PublicInstructorSummary[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(false); setTests([]);
    void publicInstructorTests().then(data => { if (!cancelled) setTests(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [reloadKey, retry]);

  if (!error && tests.length === 0) return null;
  return <section className="instructor-public instructor-public-scope" aria-labelledby="public-instructor-title">
    <div className="instructor-public-section-title"><span className="instructor-public-form-icon"><BookOpenCheck size={25} /></span><div><p className="instructor-public-kicker">Formación y evaluación</p><h2 id="public-instructor-title">Prueba de instructores</h2><p className="instructor-muted">Pon a prueba tus conocimientos. Ingresa con el código facilitado por el responsable.</p></div></div>
    {error ? <div className="instructor-error" role="alert">
      <p>No se pudieron cargar las pruebas de instructores.</p>
      <button type="button" className="instructor-btn" onClick={() => setRetry(n => n + 1)}>Reintentar pruebas de instructores</button>
    </div> : <div className="instructor-public-cards">{tests.map(test => <article key={test.id} className="instructor-panel instructor-public-card">
      <div className="instructor-public-card-top"><span className="instructor-public-card-icon"><FileCheck2 size={23} /></span><span className="instructor-state-pill" data-state={test.availability ?? 'open'}>{test.availability === 'scheduled' ? 'Próximamente' : test.availability === 'closed' ? 'Finalizada' : 'Disponible'}</span></div>
      <h3 className="instructor-summary-name">{test.nombre}</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{test.instrucciones}</p>
      {test.opens_at && test.closes_at && <p className="instructor-muted">{formatInstructorSchedule(test.opens_at)} — {formatInstructorSchedule(test.closes_at)} · Honduras<br />{test.availability === 'scheduled' ? 'Todavía no habilitada' : test.availability === 'closed' ? 'Horario finalizado' : 'Horario habilitado'}</p>}
      <div className="instructor-row instructor-between">
        <span className="instructor-public-card-facts"><Layers3 size={15} /><span>{test.question_count} preguntas{test.inciso_count != null ? ` · ${test.inciso_count} incisos` : ''} · Acceso con código</span><KeyRound size={14} /></span>
        <Link className="instructor-btn instructor-btn-primary" aria-label={`Realizar ${test.nombre}`} to={`/evaluaciones/instructores/${test.id}`}>{test.availability === 'closed' ? 'Ver prueba y resultados' : test.availability === 'scheduled' ? 'Ver horario de la prueba' : 'Entrar a la prueba'}<ArrowUpRight size={17} /></Link>
      </div>
    </article>)}</div>}
  </section>;
}
