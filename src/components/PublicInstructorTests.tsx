import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { publicInstructorTests, type PublicInstructorSummary } from '../services/instructorTests';
import '../styles/instructorTests.css';

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
  return <section className="instructor-public" aria-labelledby="public-instructor-title">
    <h2 id="public-instructor-title">Prueba de instructores</h2>
    <p className="instructor-muted">Evaluaciones para instructores. Necesitas el código de acceso para comenzar.</p>
    {error ? <div className="instructor-error" role="alert">
      <p>No se pudieron cargar las pruebas de instructores.</p>
      <button type="button" className="instructor-btn" onClick={() => setRetry(n => n + 1)}>Reintentar pruebas de instructores</button>
    </div> : tests.map(test => <article key={test.id} className="instructor-panel">
      <h3 className="instructor-summary-name">{test.nombre}</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{test.instrucciones}</p>
      <div className="instructor-row instructor-between">
        <span className="instructor-muted">{test.question_count} preguntas{test.inciso_count != null ? ` · ${test.inciso_count} incisos` : ''} · Acceso con código</span>
        <Link className="instructor-btn instructor-btn-primary" to={`/evaluaciones/instructores/${test.id}`}>Realizar {test.nombre}</Link>
      </div>
    </article>)}
  </section>;
}
