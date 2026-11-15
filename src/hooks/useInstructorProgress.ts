import { useCallback, useEffect, useRef, useState } from 'react';
import { saveInstructorProgress } from '../services/instructorTests';
import type { InstructorAnswers } from '../types/instructorQuestions';

export default function useInstructorProgress(id: string, token: string, enabled: boolean, initialRevision: number, answers: InstructorAnswers, currentQuestion: string | null) {
  const [status, setStatus] = useState<'saved' | 'pending' | 'saving' | 'error'>('saved');
  const [error, setError] = useState('');
  const revision = useRef(initialRevision), saved = useRef(''), queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef({ answers, currentQuestion }); latest.current = { answers, currentQuestion };
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const generation = useRef(0);
  useEffect(() => {
    generation.current++; revision.current = initialRevision; saved.current = JSON.stringify(latest.current); queue.current = Promise.resolve(); setStatus('saved'); setError('');
    return () => { generation.current++; clearTimeout(timer.current); };
  }, [token, enabled, initialRevision]);
  const flush = useCallback(() => {
    clearTimeout(timer.current);
    if (!enabled) return Promise.resolve();
    const payload = latest.current, key = JSON.stringify(payload), currentGeneration = generation.current;
    const operation = queue.current.catch(() => {}).then(async () => {
      if (currentGeneration !== generation.current || saved.current === key) return;
      setStatus('saving'); setError('');
      try {
        const response = await saveInstructorProgress(id, token, revision.current, payload.answers, payload.currentQuestion);
        if (currentGeneration !== generation.current) return;
        revision.current = response.progress_revision; saved.current = key;
        setStatus(JSON.stringify(latest.current) === key ? 'saved' : 'pending');
      } catch (e) {
        if (currentGeneration === generation.current) { setStatus('error'); setError(e instanceof Error ? e.message : 'No se pudo guardar el progreso.'); }
        throw e;
      }
    });
    queue.current = operation; return operation;
  }, [id, token, enabled]);
  useEffect(() => {
    if (!enabled || saved.current === JSON.stringify({ answers, currentQuestion })) return;
    setStatus('pending'); clearTimeout(timer.current);
    timer.current = setTimeout(() => { void flush().catch(() => {}); }, 700);
    return () => clearTimeout(timer.current);
  }, [answers, currentQuestion, enabled, flush]);
  useEffect(() => {
    if (!enabled || status === 'saved') return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [enabled, status]);
  return { status, error, flush };
}
