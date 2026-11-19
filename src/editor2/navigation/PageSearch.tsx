import React, { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  ChevronRight,
  Home,
  Search,
  SearchX,
} from 'lucide-react';
import {
  childrenByParent,
  filterPages,
  groupPagesBySection,
  normalizeSearchValue,
  sectionsFor,
  workspacePath,
  type Editor2PageSummary,
} from '../services/pageIndex';

interface PageSearchProps {
  pages: Editor2PageSummary[];
  recentPages?: Editor2PageSummary[];
  onClearRecents?: () => void;
  initialQuery?: string;
  initialSection?: string;
  focusOnMount?: boolean;
}

const FIXED_ICONS = {
  home: Home,
  temario: BookOpen,
  creditos: Award,
} as const;

const fixedIconFor = (pageKey: string) =>
  FIXED_ICONS[pageKey as keyof typeof FIXED_ICONS] ?? BookOpen;

const pad = (value: number) => String(value).padStart(2, '0');

const parcialLabel = (value: string) =>
  /^(primer|segundo|tercer|cuarto)$/i.test(value.trim())
    ? `${value.trim()} parcial`
    : value;

const describeResult = (
  page: Editor2PageSummary,
  parent: Editor2PageSummary | undefined,
): string => {
  if (page.kind === 'subtema') {
    return parent ? `Subtema de ${parent.title}` : 'Subtema';
  }
  if (page.kind === 'tema') {
    return `Tema · ${page.parcial ?? 'Temario'}`;
  }
  return page.section;
};

interface TemaStageProps {
  tema: Editor2PageSummary;
  number: number;
  subtemas: Editor2PageSummary[];
}

const TemaStage: React.FC<TemaStageProps> = ({ tema, number, subtemas }) => (
  <article className="e2-tema-stage" aria-label={`Tema ${tema.title}`}>
    <header className="e2-tema-stage__head">
      <div className="e2-tema-stage__title">
        <span className="e2-eyebrow">
          {parcialLabel(tema.parcial ?? 'Temario')} · Tema {pad(number)}
        </span>
        <h2>{tema.title}</h2>
        <p>
          {subtemas.length === 0
            ? 'Sin subtemas registrados'
            : `${subtemas.length} ${subtemas.length === 1 ? 'subtema' : 'subtemas'} en este tema`}
          {' · '}
          <span className="e2-mono">{tema.publicPath}</span>
        </p>
      </div>
      <Link className="e2-button" to={workspacePath(tema.pageKey)}>
        Editar tema
        <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </header>

    <div className="e2-tema-stage__rule" aria-hidden="true" />

    <div className="e2-tema-stage__body">
      <div className="e2-subtemas__head">
        <h3>Subtemas</h3>
        <span className="e2-count">{subtemas.length}</span>
      </div>

      {subtemas.length > 0 ? (
        <ul className="e2-subtemas">
          {subtemas.map((subtema, index) => (
            <li key={subtema.pageKey}>
              <Link to={workspacePath(subtema.pageKey)} className="e2-subtema">
                <span className="e2-subtema__num" aria-hidden="true">
                  {pad(index + 1)}
                </span>
                <span className="e2-subtema__text">
                  <strong>{subtema.title}</strong>
                </span>
                <span className="e2-subtema__cta">
                  Editar
                  <ArrowUpRight size={15} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="e2-empty-inline">
          <p>Este tema todavía no tiene subtemas registrados.</p>
        </div>
      )}
    </div>
  </article>
);

const BaseStage: React.FC<{ pages: Editor2PageSummary[] }> = ({ pages }) => (
  <article className="e2-base-stage" aria-label="Páginas base">
    <header className="e2-base-stage__head">
      <span className="e2-eyebrow">Páginas base</span>
      <h2>El sitio empieza aquí</h2>
      <p>
        El catálogo no tiene temas disponibles ahora mismo. Estas páginas siguen
        accesibles para trabajar en ellas.
      </p>
    </header>
    <div className="e2-base-grid">
      {pages.map((page) => {
        const Icon = fixedIconFor(page.pageKey);
        return (
          <Link key={page.pageKey} to={workspacePath(page.pageKey)} className="e2-base-card">
            <span className="e2-base-card__icon" aria-hidden="true">
              <Icon size={22} />
            </span>
            <strong>{page.title}</strong>
            <p>{page.description}</p>
            <span className="e2-base-card__path e2-mono">{page.publicPath}</span>
            <span className="e2-base-card__cta">
              Abrir
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </Link>
        );
      })}
    </div>
  </article>
);

export const PageSearch: React.FC<PageSearchProps> = ({
  pages,
  recentPages = [],
  onClearRecents,
  initialQuery = '',
  initialSection = 'Todas',
  focusOnMount = false,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const [query, setQuery] = useState(initialQuery);
  const [section, setSection] = useState(initialSection);
  const [selectedTemaKey, setSelectedTemaKey] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const fixedPages = useMemo(() => pages.filter((page) => page.kind === 'fixed'), [pages]);
  const temas = useMemo(() => pages.filter((page) => page.kind === 'tema'), [pages]);
  const children = useMemo(() => childrenByParent(pages), [pages]);
  const sections = useMemo(() => ['Todas', ...sectionsFor(pages)], [pages]);

  const isBrowsing = normalizeSearchValue(query) === '' && section === 'Todas';
  const results = useMemo(() => filterPages(pages, query, section), [pages, query, section]);
  const groups = useMemo(() => groupPagesBySection(results), [results]);

  // Ordena cada sección como árbol: el tema y, justo debajo, sus subtemas.
  const orderedGroups = useMemo(
    () => groups.map(([groupName, groupPages]) => {
      const keys = new Set(groupPages.map((page) => page.pageKey));
      const roots = groupPages.filter(
        (page) => !page.parentPageKey || !keys.has(page.parentPageKey),
      );
      const ordered = roots.flatMap((root) => [
        root,
        ...(children.get(root.pageKey) ?? []).filter((child) => keys.has(child.pageKey)),
      ]);
      const orderedKeys = new Set(ordered.map((page) => page.pageKey));
      for (const page of groupPages) {
        if (!orderedKeys.has(page.pageKey)) ordered.push(page);
      }
      return [groupName, ordered] as [string, Editor2PageSummary[]];
    }),
    [groups, children],
  );

  const visibleResults = useMemo(
    () => orderedGroups.flatMap(([, groupPages]) => groupPages),
    [orderedGroups],
  );
  const activeResult = visibleResults[activeIndex] ?? visibleResults[0];
  const resultIndexByKey = useMemo(
    () => new Map(visibleResults.map((page, index) => [page.pageKey, index])),
    [visibleResults],
  );

  const selectedTema = useMemo(
    () => temas.find((tema) => tema.pageKey === selectedTemaKey) ?? temas[0],
    [temas, selectedTemaKey],
  );
  const selectedIndex = selectedTema ? temas.indexOf(selectedTema) : -1;
  const selectedSubtemas = useMemo(
    () => selectedTema ? (children.get(selectedTema.pageKey) ?? []) : [],
    [children, selectedTema],
  );

  const temasByParcial = useMemo(() => {
    const grouped = new Map<string, Editor2PageSummary[]>();
    for (const tema of temas) {
      const key = tema.parcial?.trim() || 'Sin parcial';
      const list = grouped.get(key) ?? [];
      list.push(tema);
      grouped.set(key, list);
    }
    return [...grouped.entries()];
  }, [temas]);

  useEffect(() => {
    if (initialSection && !sections.includes(initialSection)) setSection('Todas');
  }, [initialSection, sections]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, section]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(visibleResults.length - 1, 0)));
  }, [visibleResults.length]);

  useEffect(() => {
    if (focusOnMount) inputRef.current?.focus();
  }, [focusOnMount]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectTema = (tema: Editor2PageSummary) => {
    setSelectedTemaKey(tema.pageKey);
    setQuery('');
    setSection('Todas');
    setActiveIndex(0);
  };

  const clearFilters = () => {
    setQuery('');
    setSection('Todas');
    setActiveIndex(0);
  };

  const openActiveResult = () => {
    if (activeResult) navigate(workspacePath(activeResult.pageKey));
  };

  const moveTema = (direction: 1 | -1) => {
    if (temas.length === 0) return;
    const current = selectedIndex >= 0 ? selectedIndex : 0;
    const next = Math.min(Math.max(current + direction, 0), temas.length - 1);
    setSelectedTemaKey(temas[next].pageKey);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (isBrowsing) moveTema(1);
      else setActiveIndex((current) => Math.min(current + 1, Math.max(visibleResults.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (isBrowsing) moveTema(-1);
      else setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (isBrowsing) {
        if (selectedTema) navigate(workspacePath(selectedTema.pageKey));
      } else {
        openActiveResult();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (query) setQuery('');
      else if (section !== 'Todas') setSection('Todas');
      else inputRef.current?.blur();
    }
  };

  return (
    <div className="e2-app">
      <aside className="e2-rail" aria-label="Navegación de páginas">
        <div className="e2-rail__head">
          <h1>
            Editor de páginas{' '}
            <span className="e2-version-pill">2.0</span>
          </h1>
        </div>

        <div className="e2-command">
          <Search className="e2-command__icon" size={17} aria-hidden="true" />
          <label htmlFor={`${baseId}-search`} className="e2-visually-hidden">
            Buscar páginas
          </label>
          <input
            ref={inputRef}
            id={`${baseId}-search`}
            className="e2-command__input"
            type="search"
            value={query}
            placeholder="Buscar tema o página"
            autoComplete="off"
            aria-controls={`${baseId}-stage`}
            aria-activedescendant={
              !isBrowsing && activeResult
                ? `${baseId}-option-${resultIndexByKey.get(activeResult.pageKey)}`
                : undefined
            }
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onInputKeyDown}
          />
          <kbd className="e2-command__shortcut" aria-hidden="true">Ctrl K</kbd>
        </div>

        <details className="e2-rail__section e2-base-disclosure">
          <summary className="e2-rail__label">
            <ChevronRight size={15} aria-hidden="true" />
            <span>Páginas base</span>
            <span className="e2-count" aria-hidden="true">{fixedPages.length}</span>
          </summary>
          <ul className="e2-base">
            {fixedPages.map((page) => {
              const Icon = fixedIconFor(page.pageKey);
              return (
                <li key={page.pageKey}>
                  <Link to={workspacePath(page.pageKey)} className="e2-base-link">
                    <span className="e2-base-link__icon" aria-hidden="true">
                      <Icon size={16} />
                    </span>
                    <span className="e2-base-link__text">
                      <strong>{page.title}</strong>
                      <small>{page.publicPath}</small>
                    </span>
                    <ChevronRight className="e2-base-link__chevron" size={15} aria-hidden="true" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </details>

        <section className="e2-rail__section e2-rail__section--temas" aria-labelledby={`${baseId}-temas-label`}>
          <h2 className="e2-rail__label" id={`${baseId}-temas-label`}>
            <span>Temario</span>
            <span className="e2-count" aria-hidden="true">{temas.length}</span>
          </h2>

          {temas.length === 0 ? (
            <p className="e2-rail__hint">El catálogo no tiene temas disponibles.</p>
          ) : (
            <ul className="e2-temas">
              {temasByParcial.map(([parcial, temasDelParcial]) => (
                <Fragment key={parcial}>
                  <li className="e2-temas__group" aria-hidden="true">
                    <span>{parcialLabel(parcial)}</span>
                    <span>{temasDelParcial.length}</span>
                  </li>
                  {temasDelParcial.map((tema) => {
                    const number = temas.indexOf(tema) + 1;
                    const childCount = (children.get(tema.pageKey) ?? []).length;
                    const isSelected = tema.pageKey === selectedTema?.pageKey;
                    return (
                      <li key={tema.pageKey}>
                        <button
                          type="button"
                          className={`e2-tema-link${isSelected ? ' is-active' : ''}`}
                          aria-pressed={isSelected}
                          onClick={() => selectTema(tema)}
                        >
                          <span className="e2-tema-link__num" aria-hidden="true">{pad(number)}</span>
                          <span className="e2-tema-link__text">
                            <strong>{tema.title}</strong>
                            <small>{childCount} {childCount === 1 ? 'subtema' : 'subtemas'}</small>
                          </span>
                          <ChevronRight className="e2-tema-link__chevron" size={15} aria-hidden="true" />
                        </button>
                      </li>
                    );
                  })}
                </Fragment>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <section className="e2-stage" id={`${baseId}-stage`} aria-label="Área de trabajo del editor">
        {recentPages.length > 0 && (
          <section className="e2-recents" aria-labelledby={`${baseId}-recents`}>
            <div className="e2-recents__head">
              <h2 id={`${baseId}-recents`}>Continuar donde lo dejaste</h2>
              {onClearRecents && (
                <button type="button" className="e2-link-button" onClick={onClearRecents}>
                  Limpiar recientes
                </button>
              )}
            </div>
            <ul className="e2-recents__list">
              {recentPages.map((page, index) => (
                <li key={page.pageKey}>
                  <Link
                    to={workspacePath(page.pageKey)}
                    className={`e2-recent${index === 0 ? ' is-continue' : ''}`}
                  >
                    <span className="e2-recent__badge">
                      {index === 0 ? 'Continuar' : 'Reciente'}
                    </span>
                    <strong>{page.title}</strong>
                    <small>{page.section}</small>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isBrowsing ? (
          selectedTema ? (
            <TemaStage
              tema={selectedTema}
              number={selectedIndex + 1}
              subtemas={selectedSubtemas}
            />
          ) : (
            <BaseStage pages={fixedPages} />
          )
        ) : (
          <article className="e2-results-panel" aria-label="Resultados de búsqueda">
            <header className="e2-results-panel__head">
              <div>
                <span className="e2-eyebrow">Búsqueda</span>
                <h2>
                  {query.trim()
                    ? <>Resultados para <q>{query.trim()}</q></>
                    : `Páginas: ${section}`}
                </h2>
                <p>
                  {visibleResults.length} {visibleResults.length === 1 ? 'página' : 'páginas'} encontradas
                </p>
              </div>

              <div className="e2-scope" role="group" aria-label="Filtrar por sección">
                {sections.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`e2-scope__chip${section === name ? ' is-active' : ''}`}
                    aria-pressed={section === name}
                    onClick={() => setSection(name)}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </header>

            {visibleResults.length === 0 ? (
              <div className="e2-no-results">
                <span className="e2-no-results__icon" aria-hidden="true">
                  <SearchX size={26} />
                </span>
                <h3>Sin coincidencias</h3>
                <p>No hay páginas que coincidan con esa búsqueda y sección.</p>
                <button type="button" className="e2-button e2-button--quiet" onClick={clearFilters}>
                  Limpiar filtros
                </button>
              </div>
            ) : (
              <div
                id={`${baseId}-results`}
                className="e2-results"
                role="listbox"
                aria-label="Páginas encontradas"
              >
                {orderedGroups.map(([groupName, groupPages]) => (
                  <div key={groupName} className="e2-results__group" role="group" aria-label={groupName}>
                    <h3>{groupName}</h3>
                    <ul className="e2-results__list" role="presentation">
                      {groupPages.map((page) => {
                        const index = resultIndexByKey.get(page.pageKey) ?? 0;
                        const isSelected = activeResult?.pageKey === page.pageKey;
                        const parent = page.parentPageKey
                          ? pages.find((item) => item.pageKey === page.parentPageKey)
                          : undefined;
                        const Icon = page.kind === 'fixed' ? fixedIconFor(page.pageKey) : null;
                        return (
                          <li
                            key={page.pageKey}
                            id={`${baseId}-option-${index}`}
                            role="option"
                            aria-selected={isSelected}
                            className={`e2-result e2-result--${page.kind}${isSelected ? ' is-active' : ''}`}
                          >
                            <Link
                              to={workspacePath(page.pageKey)}
                              className="e2-result__link"
                              onMouseEnter={() => setActiveIndex(index)}
                              onFocus={() => setActiveIndex(index)}
                            >
                              <span className="e2-result__icon" aria-hidden="true">
                                {Icon ? <Icon size={16} /> : <span>{pad(index + 1)}</span>}
                              </span>
                              <span className="e2-result__text">
                                <strong>{page.title}</strong>
                                <small>{describeResult(page, parent)}</small>
                              </span>
                              <span className="e2-result__path e2-mono">{page.publicPath}</span>
                              <ArrowUpRight className="e2-result__arrow" size={15} aria-hidden="true" />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}
      </section>
    </div>
  );
};

export default PageSearch;
