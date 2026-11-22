import { ChevronDown, Link2 } from 'lucide-react';
import { useMemo, type MouseEvent, type ReactNode } from 'react';
import type { Editor2PageSummary, PageIndexLoadResult } from '../services/pageIndex';
import InspectorDialog from './InspectorDialog';

function DestinationGroup({ label, open, children }: { label: string; open?: boolean; children: ReactNode }) {
  return (
    <details className="e2-destination-group" open={open}>
      <summary><span>{label}</span><ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="e2-destination-group__body">{children}</div>
    </details>
  );
}

export default function ButtonDestinationPicker({ index, href, onSelect, weeklyOnly, openRequest, onClose }: {
  index: PageIndexLoadResult | null;
  href: string;
  onSelect: (href: string) => void;
  weeklyOnly?: boolean;
  openRequest?: boolean;
  onClose?: () => void;
}) {
  const { topics, subtopicsByTopic, otherPages, ungrouped } = useMemo(() => {
    const pages = index?.pages ?? [];
    const topics = pages.filter(page => page.kind === 'tema');
    const topicKeys = new Set(topics.map(topic => topic.pageKey));
    const subtopicsByTopic = new Map<string, Editor2PageSummary[]>();
    const ungrouped: Editor2PageSummary[] = [];
    for (const page of pages) {
      if (page.kind !== 'subtema') continue;
      if (!page.parentPageKey || !topicKeys.has(page.parentPageKey)) {
        ungrouped.push(page);
        continue;
      }
      const siblings = subtopicsByTopic.get(page.parentPageKey) ?? [];
      siblings.push(page);
      subtopicsByTopic.set(page.parentPageKey, siblings);
    }
    return { topics, subtopicsByTopic, otherPages: pages.filter(page => page.kind === 'fixed'), ungrouped };
  }, [index]);
  const selected = index?.pages.find(page => page.publicPath === href);

  function choose(event: MouseEvent<HTMLButtonElement>, path: string) {
    event.currentTarget.closest('dialog')?.close();
    onSelect(path);
  }

  function links(pages: Editor2PageSummary[]) {
    if (!pages.length) return <p className="e2-destination-hint">No hay destinos disponibles.</p>;
    return pages.map(page => (
      <button type="button" key={page.pageKey} className="e2-destination-link"
        aria-current={page.publicPath === href ? 'true' : undefined} onClick={event => choose(event, page.publicPath)}>
        {page.title}
      </button>
    ));
  }

  return (
    <InspectorDialog label="Elegir destino en Atlas" icon={<Link2 size={14} aria-hidden="true" />}
      openRequest={openRequest} onClose={onClose}>
      <div className="e2-destination-picker">
        {selected && <p className="e2-destination-hint">Destino actual · {selected.title}</p>}
        {!index ? <p className="e2-destination-hint" role="status">Cargando el temario…</p> : (
          <>
            {index.warning && <p className="e2-destination-hint" role="status">{index.warning}</p>}
            <DestinationGroup label="Temas" open={selected?.kind !== 'subtema'}>
              {links(topics)}
            </DestinationGroup>
            <DestinationGroup label="Subtemas" open={selected?.kind === 'subtema'}>
              {subtopicsByTopic.size === 0 && links(ungrouped)}
              {topics.map(topic => {
                const subtopics = subtopicsByTopic.get(topic.pageKey);
                return subtopics && (
                  <DestinationGroup key={topic.pageKey} label={topic.title} open={selected?.parentPageKey === topic.pageKey}>
                    {links(subtopics)}
                  </DestinationGroup>
                );
              })}
              {subtopicsByTopic.size > 0 && ungrouped.length > 0 && links(ungrouped)}
            </DestinationGroup>
            {!weeklyOnly && <DestinationGroup label="Otras páginas">
              {links(otherPages)}
            </DestinationGroup>}
          </>
        )}
      </div>
    </InspectorDialog>
  );
}
