export type WeeklyThemeTest = {
  id?: string;
  tema_id?: number | null;
  created_at?: string;
};

export interface SimpleTemaCatalog {
  id: number;
  parcial: string;
  sort_order?: number | null;
  nombre?: string;
}

export const collectWeeklyThemeIds = (
  blocks: Array<{ block_type?: string; content?: Record<string, string> }> = [],
  allTemas: SimpleTemaCatalog[] = []
): number[] => {
  const hasWeekly = blocks.some((block) => block.block_type === 'weekly_publication');

  if (hasWeekly) {
    const ids = new Set<number>();

    blocks.forEach((block) => {
      if (block.block_type !== 'weekly_publication') return;

      const content = block.content ?? {};
      const topicIds = [content.topic_1_id, content.topic_2_id, content.topic_3_id];

      topicIds.forEach((rawId) => {
        const numericId = Number(rawId);
        if (Number.isFinite(numericId) && numericId > 0) {
          ids.add(numericId);
        }
      });
    });

    return Array.from(ids);
  }

  // Si el componente de temas de la semana no está en la plantilla, revisar si está el de semana de exámenes
  const examBlock = blocks.find((block) => block.block_type === 'exam_week');
  if (examBlock && allTemas.length > 0) {
    const parcial = examBlock.content?.parcial || 'primer';
    return allTemas
      .filter((t) => t.parcial === parcial)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((t) => t.id);
  }

  return [];
};

export const getActiveExamParcial = (
  blocks: Array<{ block_type?: string; content?: Record<string, string> }> = []
): string | null => {
  const hasWeekly = blocks.some((block) => block.block_type === 'weekly_publication');
  if (hasWeekly) return null;

  const examBlock = blocks.find((block) => block.block_type === 'exam_week');
  return examBlock ? (examBlock.content?.parcial || 'primer') : null;
};

export const orderTestsByWeeklyPriority = <T extends WeeklyThemeTest>(tests: T[], weeklyThemeIds: number[] = []): T[] => {
  if (!weeklyThemeIds.length) {
    return [...tests].sort((a, b) => {
      const left = new Date(a.created_at ?? 0).getTime();
      const right = new Date(b.created_at ?? 0).getTime();
      return right - left;
    });
  }

  const priorityMap = new Map<number, number>();
  weeklyThemeIds.forEach((themeId, index) => priorityMap.set(themeId, index));

  return [...tests].sort((a, b) => {
    const aThemeId = Number(a.tema_id ?? NaN);
    const bThemeId = Number(b.tema_id ?? NaN);
    const aPriority = Number.isFinite(aThemeId) && priorityMap.has(aThemeId) ? priorityMap.get(aThemeId)! : Number.MAX_SAFE_INTEGER;
    const bPriority = Number.isFinite(bThemeId) && priorityMap.has(bThemeId) ? priorityMap.get(bThemeId)! : Number.MAX_SAFE_INTEGER;

    if (aPriority !== bPriority) {
      return aPriority - bPriority;
    }

    const aTime = new Date(a.created_at ?? 0).getTime();
    const bTime = new Date(b.created_at ?? 0).getTime();
    return bTime - aTime;
  });
};

export const groupHistoricalTestsByPartial = <T extends { parcial_key?: string | null; scope?: string; tema_id?: number | null; tema?: { nombre?: string } | null; created_at?: string }>(tests: T[] = []) => {
  const grouped = new Map<string, T[]>();

  tests.forEach((test) => {
    const key = String(test.parcial_key ?? 'sin-parcial');
    const current = grouped.get(key) ?? [];
    current.push(test);
    grouped.set(key, current);
  });

  return Array.from(grouped.entries())
    .map(([key, items]) => ({
      key,
      items: [...items].sort((a, b) => {
        const scopeDelta = (['parcial', 'tema', 'subtema'] as const).indexOf((a.scope ?? 'subtema') as any) - (['parcial', 'tema', 'subtema'] as const).indexOf((b.scope ?? 'subtema') as any);
        if (scopeDelta !== 0) return scopeDelta;
        return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
      }),
    }))
    .sort((a, b) => (a.key === 'primer' ? -1 : b.key === 'primer' ? 1 : a.key === 'segundo' ? -1 : b.key === 'segundo' ? 1 : 0));
};
