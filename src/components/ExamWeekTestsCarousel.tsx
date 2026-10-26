import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-auto-scroll';
import { BookOpenCheck, ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../services/supabase';
import { getCachedTemas, type CatalogTema } from '../services/catalogService';
import { getCloudinaryImageUrl } from '../services/cloudinaryImages';
import { toSafeHtml } from '../services/richText';
import {
  canBypassMaintenance, fetchSiteMaintenanceStatus, isFeatureDisabled, isTemaDisabled,
  subscribeSiteMaintenanceStatus, type SiteMaintenanceStatus,
} from '../services/siteMaintenance';
import './examWeekTestsCarousel.css';

interface ExamTest {
  id: string;
  nombre: string;
  estado: string;
  parcial_key: string;
  tema_id: number | null;
  created_at: string;
  image_url: string | null;
  tema: { logo_url: string | null } | null;
  subtema: { logo_url: string | null; tema_id: number | null } | null;
}

const themeIdFor = (test: ExamTest) => test.tema_id ?? test.subtema?.tema_id ?? null;
const parcialNames: Record<string, string> = { primer: 'Primer parcial', segundo: 'Segundo parcial', tercer: 'Tercer parcial' };
const topicColors = ['#7c3aed', '#0284c7', '#0f766e', '#c2410c', '#be185d', '#4338ca', '#4d7c0f', '#a16207'];

const TestThumbnail: React.FC<{ test: ExamTest }> = ({ test }) => {
  const images = [test.image_url, test.subtema?.logo_url, test.tema?.logo_url].filter(Boolean) as string[];
  const [index, setIndex] = useState(0);
  return images[index]
    ? <img src={getCloudinaryImageUrl(images[index], 'cardWide')} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setIndex(value => value + 1)} />
    : <BookOpenCheck size={36} aria-hidden="true" />;
};

const ExamWeekTestsCarousel: React.FC<{ parcial: string }> = ({ parcial }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  const [tests, setTests] = useState<ExamTest[]>([]);
  const [themes, setThemes] = useState<CatalogTema[]>([]);
  const [maintenance, setMaintenance] = useState<SiteMaintenanceStatus | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadedParcial, setLoadedParcial] = useState('');
  const [retry, setRetry] = useState(0);
  const [paused, setPaused] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const autoScroll = useMemo(() => AutoScroll({
    active: !paused,
    speed: 0.6,
    startDelay: 1200,
    stopOnInteraction: false,
    stopOnMouseEnter: true,
    stopOnFocusIn: true,
    breakpoints: { '(prefers-reduced-motion: reduce)': { active: false } },
  }), [paused]);
  const [viewportRef, carousel] = useEmblaCarousel({ align: 'start', containScroll: 'trimSnaps', slidesToScroll: 1, loop: true }, [autoScroll]);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    let active = true;
    const update = (value: SiteMaintenanceStatus) => { if (active) setMaintenance(value); };
    void fetchSiteMaintenanceStatus().then(update);
    const unsubscribe = subscribeSiteMaintenanceStatus(update);
    return () => { active = false; unsubscribe(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const load = async () => {
      try {
        const [result, temas] = await Promise.all([
          supabase.from('pruebas')
            .select('id, nombre, estado, parcial_key, tema_id, created_at, image_url, tema:temas(logo_url), subtema:subtemas(logo_url, tema_id)')
            .eq('estado', 'publicada').eq('parcial_key', parcial)
            .order('created_at', { ascending: false }),
          getCachedTemas(),
        ]);
        if (result.error) throw result.error;
        if (cancelled) return;
        setTests((result.data ?? []) as unknown as ExamTest[]);
        // El catálogo ya viene en el orden que utiliza TemarioPublico.
        setThemes(temas.filter(tema => tema.parcial === parcial));
        setLoadedParcial(parcial);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [parcial, retry]);

  const groups = useMemo(() => {
    if (loadedParcial !== parcial || !maintenance) return [];
    const bypass = canBypassMaintenance(user, isAuthenticated);
    const disabled = maintenance.disabledFeatures;
    if (!bypass && isFeatureDisabled('evaluations', disabled)) return [];
    const available = tests.filter(test => test.parcial_key === parcial && test.estado === 'publicada'
      && (bypass || !isTemaDisabled(themeIdFor(test), parcial, disabled)));
    const ordered = [...available].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || a.id.localeCompare(b.id));
    const result = themes.map(theme => ({
      id: String(theme.id), name: theme.nombre,
      tests: ordered.filter(test => themeIdFor(test) === theme.id),
    })).filter(group => group.tests.length > 0);
    const catalogIds = new Set(themes.map(theme => theme.id));
    const otherTests = ordered.filter(test => themeIdFor(test) !== null && !catalogIds.has(themeIdFor(test)!));
    if (otherTests.length) result.push({ id: 'other', name: 'Otros temas', tests: otherTests });
    const generalTests = ordered.filter(test => themeIdFor(test) === null);
    if (generalTests.length) result.push({ id: 'general', name: 'Repaso general', tests: generalTests });
    return result;
  }, [tests, themes, parcial, loadedParcial, maintenance, user, isAuthenticated]);
  const visibleTests = useMemo(() => groups.flatMap(group => group.tests), [groups]);
  const groupStarts = groups.map((_, index) => groups.slice(0, index).reduce((sum, previous) => sum + previous.tests.length, 0));
  const activeGroupIndex = groupStarts.reduce((active, start, index) => start <= activeSlide ? index : active, 0);
  const visibleTestIds = visibleTests.map(test => test.id).join(',');

  useEffect(() => {
    if (!carousel) return;
    const update = () => {
      setCanPrev(carousel.canScrollPrev());
      setCanNext(carousel.canScrollNext());
      setActiveSlide(carousel.selectedScrollSnap());
    };
    carousel.scrollTo(0, true);
    update();
    carousel.on('select', update).on('reInit', update);
    return () => { carousel.off('select', update).off('reInit', update); };
  }, [carousel, parcial, visibleTestIds]);

  const navigateCarousel = (navigate: () => void) => {
    if (!carousel) return;
    // Usar la instancia que Embla tiene instalada, también tras una recarga
    // en caliente: la instancia creada por React puede haber sido reemplazada.
    const runningAutoScroll = carousel.plugins().autoScroll;
    runningAutoScroll?.stop();
    navigate();
    // Los controles están fuera del área arrastrable: no reciben el pointerUp
    // con el que el complemento reanuda automáticamente después de un gesto.
    if (!paused && carousel.scrollSnapList().length > 1
      && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      runningAutoScroll?.play(1200);
    }
  };

  const move = (direction: 'previous' | 'next') => {
    navigateCarousel(() => {
      if (direction === 'previous') carousel?.scrollPrev();
      else carousel?.scrollNext();
    });
  };

  const topicStyle = (id: string): React.CSSProperties => {
    const index = themes.findIndex(theme => String(theme.id) === id);
    return { ['--topic-color' as string]: index >= 0 ? topicColors[index % topicColors.length] : '#64748b' };
  };

  return (
    <section className="exam-tests" aria-label="Evaluaciones prácticas">
      <div className="exam-tests-heading">
        <div className="exam-tests-title"><h3>Evaluaciones prácticas</h3><span className="exam-tests-partial">{parcialNames[parcial] || parcial}</span></div>
        {visibleTests.length > 1 && status === 'ready' && <div className="exam-tests-controls">
          <button type="button" aria-label={paused ? 'Reanudar movimiento' : 'Pausar movimiento'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={17} /> : <Pause size={17} />}</button>
          <button type="button" aria-label="Pruebas anteriores" disabled={!canPrev} onClick={() => move('previous')}><ChevronLeft size={20} /></button>
          <button type="button" aria-label="Pruebas siguientes" disabled={!canNext} onClick={() => move('next')}><ChevronRight size={20} /></button>
        </div>}
      </div>
      {status === 'ready' && groups.length > 0 && <nav className="exam-tests-topics" aria-label="Ir a las pruebas de un tema">
        {groups.map((group, index) => <button
          key={group.id} type="button" aria-pressed={index === activeGroupIndex}
          style={topicStyle(group.id)}
          onClick={() => navigateCarousel(() => carousel?.scrollTo(groupStarts[index]))}
        ><span>{group.name}</span><span className="exam-tests-count" aria-label={`${group.tests.length} ${group.tests.length === 1 ? 'prueba' : 'pruebas'}`}>{group.tests.length}</span></button>)}
      </nav>}
      {status === 'error' ? <p role="alert">No se pudieron cargar las pruebas. <button type="button" onClick={() => setRetry(value => value + 1)}>Reintentar</button></p>
        : status === 'loading' || loadedParcial !== parcial || !maintenance ? <p role="status">Cargando pruebas…</p>
        : visibleTests.length === 0 ? <p role="status">No hay pruebas disponibles para este parcial.</p> : null}
      <div className="exam-tests-viewport" ref={viewportRef}>
        <div className="exam-tests-track">
          {status === 'ready' && groups.flatMap(group => group.tests.map((test, index) => {
            const first = index === 0;
            const last = index === group.tests.length - 1;
            return <div key={`${parcial}:${test.id}`} className={`exam-tests-slide${first ? ' is-group-start' : ''}${last ? ' is-group-end' : ''}`}
              style={topicStyle(group.id)} role="group"
              aria-label={`${group.name}, prueba ${index + 1} de ${group.tests.length}${first ? ', inicio del tema' : ''}${last ? ', fin del tema' : ''}`}>
              <Link
                className="exam-tests-card"
                to={`/evaluaciones/ejecutar/${test.id}`}
                state={{ from: `${location.pathname}${location.search}` }}
              >
                <span className="exam-tests-thumbnail"><TestThumbnail test={test} /></span>
                <span className="exam-tests-name">{plainName(test.nombre)}</span>
              </Link>
            </div>;
          }))}
        </div>
      </div>
    </section>
  );
};

export default ExamWeekTestsCarousel;

function plainName(value: string) {
  const element = document.createElement('div');
  element.innerHTML = toSafeHtml(value);
  return element.textContent?.trim() || 'Prueba';
}
