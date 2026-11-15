import { useState } from 'react';
import HoldToRevealCodeInput from './HoldToRevealCodeInput';
import InstructorReferenceImageView from './InstructorReferenceImageView';
import InstructorSectionScores from './InstructorSectionScores';
import { getInstructorParticipantResult, isInstructorAccount, isSixDigitCode, type InstructorParticipantResult } from '../services/instructorTests';
import { formatInstructorPoints, groupPublicInstructorQuestions, incisoLetter, instructorIncisoWeight, isInstructorPointAnswer, requiresInstructorReview } from '../types/instructorQuestions';

export default function InstructorParticipantResults({ testId }: { testId: string }) {
  const [code, setCode] = useState(''), [account, setAccount] = useState('');
  const [data, setData] = useState<InstructorParticipantResult | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  return <section className="instructor-panel" aria-label="Consultar mi prueba revisada">
    <h2>Consultar mi prueba revisada</h2><p className="instructor-muted">Consulta tus respuestas y calificación con el código de la prueba y tu número de cuenta. Esta consulta no inicia otro intento.</p>
    {!data && <form onSubmit={async event => {
      event.preventDefault(); if (busy || !isSixDigitCode(code) || !isInstructorAccount(account)) return;
      setBusy(true); setError('');
      try { const result = await getInstructorParticipantResult(testId, code, account);
        if (result.ok) { setData(result); setCode(''); }
        else setError(result.status === 'pending' ? 'Tu entrega está pendiente de revisión. Vuelve a consultar cuando el responsable termine de revisarla.' : result.status === 'locked' ? 'Demasiados intentos. Espera 15 minutos antes de consultar otra vez.' : 'No se encontró una entrega con esos datos. Comprueba el código y el número de cuenta.');
      } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo consultar tu resultado.'); } finally { setBusy(false); }
    }}>
      <HoldToRevealCodeInput label="Código para consultar resultados" inputMode="numeric" autoComplete="off" maxLength={6} value={code} disabled={busy} onChange={event => setCode(event.target.value.replace(/[^0-9]/g, ''))} />
      <label className="instructor-label">Cuenta para consultar resultados<input className="instructor-input" type="text" inputMode="numeric" autoComplete="off" maxLength={13} pattern="[0-9]{10,13}" value={account} disabled={busy} onChange={event => setAccount(event.target.value.replace(/[^0-9]/g, ''))} /></label>
      <button className="instructor-btn instructor-btn-primary" type="submit" disabled={busy || !isSixDigitCode(code) || !isInstructorAccount(account)}>{busy ? 'Consultando…' : 'Ver mis respuestas y calificación'}</button>
    </form>}
    {error && <p className="instructor-error" role="alert">{error}</p>}
    {data && <><div className="instructor-row instructor-between"><div><h3>{data.participant_name}</h3><p>Cuenta: {data.account_number} · Revisada</p></div>
      <button type="button" className="instructor-btn" onClick={() => { setData(null); setAccount(''); setError(''); }}>Cerrar resultado</button></div>
      <p className="instructor-result">{data.result.percentage}%</p><p>{formatInstructorPoints(data.result.correct)} puntos obtenidos de {data.result.total}.</p>
      <InstructorSectionScores sections={data.result.sections} />
      {groupPublicInstructorQuestions(data.snapshot.questions).map(group => <section className="instructor-public-group" key={group.id}>
        {group.section && <p className="instructor-section-heading">{group.section.nombre}</p>}<h3>Pregunta {group.position}</h3>
        {group.items.map((question, index) => {
          const answer = data.answers[question.id]; const values = answer && typeof answer === 'object' ? answer as Record<string, string> : {};
          const decision = (requiresInstructorReview(data.snapshot, question) ? data.reviews : data.auto_results)[question.id];
          return <section className="instructor-review-item" key={question.id}><h4>{incisoLetter(index)}. {question.titulo}</h4>
            <p className="instructor-muted">{formatInstructorPoints(instructorIncisoWeight(data.snapshot, question))} puntos · {decision === true ? 'Correcta' : decision === false ? 'Incorrecta' : 'Calificada'}</p>
            {question.type === 'image_point' ? <InstructorReferenceImageView url={question.image.url} annotations={isInstructorPointAnswer(answer) ? [{ ...answer, label: 'Tu respuesta' }] : []} />
              : question.type === 'short_answer' ? <>{question.image && <InstructorReferenceImageView url={question.image.url} annotations={question.image.annotations} />}<p className="instructor-submitted-answer">{String(answer ?? '')}</p></>
                : question.type === 'completion' ? question.blanks.map((blank, i) => <p key={blank.id}>Hueco {i + 1}: {values[blank.id] ?? ''}</p>)
                  : question.type === 'matching' ? question.terms.map(term => <p key={term.id}>{term.texto}: {question.choices.find(choice => choice.id === values[term.id])?.texto ?? ''}</p>)
                    : <p className="instructor-submitted-answer">{question.options.find(option => option.id === answer)?.texto ?? ''}</p>}
          </section>;
        })}
      </section>)}
    </>}
  </section>;
}
