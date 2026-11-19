export interface MarkerLocationData {
  label?: string | null;
  x?: number | null;
  y?: number | null;
  startX?: number | null;
  startY?: number | null;
  regionPoints?: number[] | null;
  regionHoles?: number[][] | null;
  regionColor?: string | null;
  regionOpacity?: number | null;
  regionStrokeWidth?: number | null;
  regionDashLength?: number | null;
  regionDashGap?: number | null;
  regionSmooth?: boolean | null;
}

export interface PlateComparisonState {
  photo_url?: string | null;
  tema_id?: number | null;
  subtema_id?: number | null;
  aumento?: string | null;
  tincion?: string | null;
  comentario?: string | null;
  is_published?: boolean | null;
  subtema_nombre?: string | null;
  tema_nombre?: string | null;
  senalados?: string[] | null;
  senalados_meta?: Array<MarkerLocationData | null> | null;
}

interface NormalizedMarkerEntry {
  label: string;
  x: number | null;
  y: number | null;
  startX: number | null;
  startY: number | null;
  regionPoints: number[] | null;
  regionHoles: number[][] | null;
  regionColor: string | null;
  regionOpacity: number | null;
  regionStrokeWidth: number | null;
  regionDashLength: number | null;
  regionDashGap: number | null;
  regionSmooth: boolean | null;
}

const COORD_EPSILON = 1e-6;

const normalizeFiniteNumber = (value: number | null | undefined): number | null => {
  if (value == null) return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const normalizeNumberArray = (values: number[] | null | undefined): number[] | null => {
  if (!Array.isArray(values) || values.length === 0) return null;
  const normalized = values.map(v => Number(v)).filter(Number.isFinite);
  return normalized.length > 0 ? normalized : null;
};

const normalizeHoles = (holes: number[][] | null | undefined): number[][] | null => {
  if (!Array.isArray(holes) || holes.length === 0) return null;
  const normalized = holes
    .map(hole => normalizeNumberArray(hole))
    .filter((hole): hole is number[] => hole !== null);
  return normalized.length > 0 ? normalized : null;
};

const normalizeMarkerEntry = (
  rawLabel: string | null | undefined,
  meta: MarkerLocationData | null | undefined
): NormalizedMarkerEntry => ({
  label: String(rawLabel ?? meta?.label ?? '').trim(),
  x: normalizeFiniteNumber(meta?.x),
  y: normalizeFiniteNumber(meta?.y),
  startX: normalizeFiniteNumber(meta?.startX),
  startY: normalizeFiniteNumber(meta?.startY),
  regionPoints: normalizeNumberArray(meta?.regionPoints),
  regionHoles: normalizeHoles(meta?.regionHoles),
  regionColor: meta?.regionColor != null && String(meta.regionColor).trim() !== ''
    ? String(meta.regionColor).trim()
    : null,
  regionOpacity: normalizeFiniteNumber(meta?.regionOpacity),
  regionStrokeWidth: normalizeFiniteNumber(meta?.regionStrokeWidth),
  regionDashLength: normalizeFiniteNumber(meta?.regionDashLength),
  regionDashGap: normalizeFiniteNumber(meta?.regionDashGap),
  regionSmooth: typeof meta?.regionSmooth === 'boolean' ? meta.regionSmooth : null,
});

const normalizeMarkerList = (
  labels?: string[] | null,
  meta?: Array<MarkerLocationData | null> | null
): NormalizedMarkerEntry[] => {
  const safeLabels = Array.isArray(labels) ? labels : [];
  const safeMeta = Array.isArray(meta) ? meta : [];
  const total = Math.max(safeLabels.length, safeMeta.length);
  const entries: NormalizedMarkerEntry[] = [];

  for (let i = 0; i < total; i++) {
    const entry = normalizeMarkerEntry(safeLabels[i], safeMeta[i]);
    const isCompletelyEmpty =
      entry.label === '' &&
      entry.x === null &&
      entry.y === null &&
      entry.startX === null &&
      entry.startY === null &&
      entry.regionPoints === null &&
      entry.regionHoles === null;
    if (!isCompletelyEmpty) {
      entries.push(entry);
    }
  }

  return entries;
};

const numbersDiffer = (
  a: number | null | undefined,
  b: number | null | undefined,
  epsilon = COORD_EPSILON
): boolean => {
  const na = normalizeFiniteNumber(a);
  const nb = normalizeFiniteNumber(b);
  if (na === null && nb === null) return false;
  if (na === null || nb === null) return true;
  return Math.abs(na - nb) > epsilon;
};

const numberArraysDiffer = (
  a: number[] | null | undefined,
  b: number[] | null | undefined,
  epsilon = COORD_EPSILON
): boolean => {
  const na = normalizeNumberArray(a);
  const nb = normalizeNumberArray(b);
  if (na === null && nb === null) return false;
  if (na === null || nb === null) return true;
  if (na.length !== nb.length) return true;
  return na.some((value, idx) => Math.abs(value - nb[idx]) > epsilon);
};

const holesDiffer = (
  a: number[][] | null | undefined,
  b: number[][] | null | undefined,
  epsilon = COORD_EPSILON
): boolean => {
  const na = normalizeHoles(a);
  const nb = normalizeHoles(b);
  if (na === null && nb === null) return false;
  if (na === null || nb === null) return true;
  if (na.length !== nb.length) return true;
  return na.some((hole, idx) => numberArraysDiffer(hole, nb[idx], epsilon));
};

const markerStyleDiffers = (a: NormalizedMarkerEntry, b: NormalizedMarkerEntry): boolean => {
  if ((a.regionColor ?? null) !== (b.regionColor ?? null)) return true;
  if (numbersDiffer(a.regionOpacity, b.regionOpacity)) return true;
  if (numbersDiffer(a.regionStrokeWidth, b.regionStrokeWidth)) return true;
  if (numbersDiffer(a.regionDashLength, b.regionDashLength)) return true;
  if (numbersDiffer(a.regionDashGap, b.regionDashGap)) return true;
  if (a.regionSmooth !== b.regionSmooth) return true;
  return false;
};

const markerEntriesDiffer = (a: NormalizedMarkerEntry, b: NormalizedMarkerEntry): boolean => {
  if (a.label !== b.label) return true;
  if (numbersDiffer(a.x, b.x)) return true;
  if (numbersDiffer(a.y, b.y)) return true;
  if (numbersDiffer(a.startX, b.startX)) return true;
  if (numbersDiffer(a.startY, b.startY)) return true;
  if (numberArraysDiffer(a.regionPoints, b.regionPoints)) return true;
  if (holesDiffer(a.regionHoles, b.regionHoles)) return true;
  if (markerStyleDiffers(a, b)) return true;
  return false;
};

/**
 * Detecta si existe cualquier cambio (incluidos ajustes finos de posición,
 * flechas, vértices de contorno, huecos, estilos visuales de borde, texto,
 * aumento, tinción, comentario, ubicación o imagen) entre dos estados de placa.
 */
export const hasPlateStateChanges = (
  before: PlateComparisonState,
  after: PlateComparisonState,
  options?: { isNewImageReplaced?: boolean }
): boolean => {
  if (options?.isNewImageReplaced) return true;

  if (before.photo_url !== undefined || after.photo_url !== undefined) {
    const oldPhoto = (before.photo_url ?? '').trim();
    const newPhoto = (after.photo_url ?? '').trim();
    if (oldPhoto !== newPhoto) return true;
  }

  if (before.tema_id !== undefined || after.tema_id !== undefined) {
    if ((before.tema_id ?? null) !== (after.tema_id ?? null)) return true;
  }

  if (before.subtema_id !== undefined || after.subtema_id !== undefined) {
    if ((before.subtema_id ?? null) !== (after.subtema_id ?? null)) return true;
  }

  if ((before.aumento ?? '').trim() !== (after.aumento ?? '').trim()) return true;
  if ((before.tincion ?? '').trim() !== (after.tincion ?? '').trim()) return true;
  if ((before.comentario ?? '').trim() !== (after.comentario ?? '').trim()) return true;

  if (before.is_published !== undefined || after.is_published !== undefined) {
    if (Boolean(before.is_published ?? true) !== Boolean(after.is_published ?? true)) return true;
  }

  const beforeMarkers = normalizeMarkerList(before.senalados, before.senalados_meta);
  const afterMarkers = normalizeMarkerList(after.senalados, after.senalados_meta);

  if (beforeMarkers.length !== afterMarkers.length) return true;

  for (let i = 0; i < afterMarkers.length; i++) {
    if (markerEntriesDiffer(beforeMarkers[i], afterMarkers[i])) {
      return true;
    }
  }

  return false;
};

/**
 * Limpia un nombre de autor o correo para mostrar siempre un nombre legible y amigable.
 * Si es un correo electrónico ("juan.perez@dominio.com"), lo transforma en "Juan Perez".
 */
export const formatCleanActorName = (
  rawName?: string | null,
  rawUsername?: string | null,
  userId?: number | null,
  userDirectory?: Map<string | number, string>
): string => {
  // 1. Búsqueda directa por ID en el directorio
  if (userId != null && userDirectory?.has(userId)) {
    const fromDir = userDirectory.get(userId)?.trim();
    if (fromDir) return fromDir;
  }

  // 2. Búsqueda por username en el directorio
  if (rawUsername) {
    const cleanUser = rawUsername.trim().toLowerCase();
    if (userDirectory?.has(cleanUser)) {
      const fromDir = userDirectory.get(cleanUser)?.trim();
      if (fromDir) return fromDir;
    }
  }

  // 3. Búsqueda por nombre previo en el directorio
  if (rawName) {
    const cleanRaw = rawName.trim().toLowerCase();
    if (userDirectory?.has(cleanRaw)) {
      const fromDir = userDirectory.get(cleanRaw)?.trim();
      if (fromDir) return fromDir;
    }
  }

  let candidate = (rawName || rawUsername || '').trim();

  // Si no hay información, retornar valor por defecto amigable
  if (!candidate || candidate.toLowerCase() === 'desconocido' || candidate.toLowerCase() === 'anonimo') {
    return 'Usuario del sistema';
  }

  // Si es un correo electrónico, convertirlo en nombre propio amigable
  if (candidate.includes('@')) {
    const prefix = candidate.split('@')[0].trim();
    const parts = prefix.split(/[._-]+/).filter(Boolean);
    if (parts.length > 0) {
      return parts
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    }
    return prefix;
  }

  return candidate;
};

/**
 * Compara el estado anterior y el nuevo de una placa para obtener la lista exacta
 * de cambios realizados por el usuario en lenguaje natural.
 */
export const computePlateChangesDiff = (
  before: PlateComparisonState,
  after: PlateComparisonState,
  options?: { isNewImageReplaced?: boolean }
): string[] => {
  const changes: string[] = [];

  // 1. Imagen física
  if (options?.isNewImageReplaced || (after.photo_url && before.photo_url && after.photo_url !== before.photo_url)) {
    changes.push('Actualizó la fotografía de la placa histológica');
  }

  // 1b. Estado de publicación (borrador / publicada)
  if (before.is_published !== undefined || after.is_published !== undefined) {
    const wasPublished = Boolean(before.is_published ?? true);
    const isNowPublished = Boolean(after.is_published ?? true);
    if (!wasPublished && isNowPublished) {
      changes.push('Publicó la placa para la vista pública');
    } else if (wasPublished && !isNowPublished) {
      changes.push('Pasó la placa a borrador (oculta en la vista pública)');
    }
  }

  // 2. Aumento
  const oldAumento = (before.aumento || '').trim();
  const newAumento = (after.aumento || '').trim();
  if (oldAumento !== newAumento) {
    if (!oldAumento && newAumento) {
      changes.push(`Configuró el aumento a "${newAumento}"`);
    } else if (oldAumento && !newAumento) {
      changes.push(`Quitó el aumento (era "${oldAumento}")`);
    } else {
      changes.push(`Cambió el aumento de "${oldAumento}" a "${newAumento}"`);
    }
  }

  // 3. Tinción
  const oldTincion = (before.tincion || '').trim();
  const newTincion = (after.tincion || '').trim();
  if (oldTincion !== newTincion) {
    if (!oldTincion && newTincion) {
      changes.push(`Configuró la tinción a "${newTincion}"`);
    } else if (oldTincion && !newTincion) {
      changes.push(`Quitó la tinción (era "${oldTincion}")`);
    } else {
      changes.push(`Cambió la tinción de "${oldTincion}" a "${newTincion}"`);
    }
  }

  // 4. Comentario / Descripción
  const oldComentario = (before.comentario || '').trim();
  const newComentario = (after.comentario || '').trim();
  if (oldComentario !== newComentario) {
    if (!oldComentario && newComentario) {
      changes.push(`Añadió notas/comentario clínico: "${newComentario.slice(0, 70)}${newComentario.length > 70 ? '...' : ''}"`);
    } else if (oldComentario && !newComentario) {
      changes.push('Eliminó el comentario clínico de la placa');
    } else {
      changes.push('Actualizó la descripción / comentario clínico de la placa');
    }
  }

  // 5. Señalados
  const oldEntries = normalizeMarkerList(before.senalados, before.senalados_meta).filter(entry => entry.label !== '');
  const newEntries = normalizeMarkerList(after.senalados, after.senalados_meta).filter(entry => entry.label !== '');

  const matchedOldIndices = new Set<number>();
  const matchedPairs: Array<{ oldEntry: NormalizedMarkerEntry; newEntry: NormalizedMarkerEntry }> = [];
  const addedEntries: NormalizedMarkerEntry[] = [];

  newEntries.forEach(newEntry => {
    // Priorizar coincidencia exacta (respetando mayúsculas/minúsculas) y luego insensible a mayúsculas
    let oldIdx = oldEntries.findIndex(
      (oldEntry, idx) => !matchedOldIndices.has(idx) && oldEntry.label === newEntry.label
    );
    if (oldIdx === -1) {
      oldIdx = oldEntries.findIndex(
        (oldEntry, idx) => !matchedOldIndices.has(idx) && oldEntry.label.toLowerCase() === newEntry.label.toLowerCase()
      );
    }

    if (oldIdx !== -1) {
      matchedOldIndices.add(oldIdx);
      matchedPairs.push({ oldEntry: oldEntries[oldIdx], newEntry });
    } else {
      addedEntries.push(newEntry);
    }
  });

  // Señalados agregados
  addedEntries.forEach(entry => {
    changes.push(`Agregó el señalado "${entry.label}"`);
  });

  // Señalados borrados
  oldEntries.forEach((entry, idx) => {
    if (!matchedOldIndices.has(idx)) {
      changes.push(`Borró el señalado "${entry.label}"`);
    }
  });

  // Señalados coincidentes que fueron modificados (nombre, posición, contorno, huecos o estilo)
  matchedPairs.forEach(({ oldEntry, newEntry }) => {
    const label = newEntry.label;

    if (oldEntry.label !== newEntry.label) {
      changes.push(`Renombró el señalado "${oldEntry.label}" a "${newEntry.label}"`);
    }

    const regionChanged = numberArraysDiffer(oldEntry.regionPoints, newEntry.regionPoints);
    if (regionChanged) {
      changes.push(`Modificó el contorno / borde del señalado "${label}"`);
    } else {
      const posChanged =
        numbersDiffer(oldEntry.x, newEntry.x) ||
        numbersDiffer(oldEntry.y, newEntry.y) ||
        numbersDiffer(oldEntry.startX, newEntry.startX) ||
        numbersDiffer(oldEntry.startY, newEntry.startY);

      if (posChanged) {
        changes.push(`Reubicó la posición del señalado "${label}"`);
      }
    }

    if (holesDiffer(oldEntry.regionHoles, newEntry.regionHoles)) {
      changes.push(`Ajustó las zonas de exclusión (huecos) del señalado "${label}"`);
    }

    if (markerStyleDiffers(oldEntry, newEntry)) {
      changes.push(`Actualizó el estilo visual del señalado "${label}"`);
    }
  });

  if (changes.length === 0) {
    changes.push('Guardó cambios generales en la información de la placa');
  }

  return changes;
};

/**
 * Reconstruye una lista comprensible de cambios para cualquier entrada del historial de auditoría.
 */
export const describeLogChanges = (log: {
  entity_type: string;
  action_type: string;
  entity_name: string;
  details?: Record<string, unknown> | null;
}): string[] => {
  const details = (log.details || {}) as Record<string, any>;

  // 1. Si ya se guardó una lista explícita de cambios amigables, usarla
  if (Array.isArray(details.cambios_resumen) && details.cambios_resumen.length > 0) {
    return details.cambios_resumen.map(String);
  }
  if (Array.isArray(details.cambios) && details.cambios.length > 0) {
    return details.cambios.map(String);
  }

  const results: string[] = [];
  const origAction = String(details.original_action || log.action_type || '');

  // 2. Registros de placas
  if (log.entity_type === 'placa') {
    if (origAction === 'upload_classified' || log.action_type === 'create') {
      results.push('Subió una nueva placa al catálogo');
      if (details.subtema_nombre) results.push(`Asignada al subtema: "${details.subtema_nombre}"`);
      if (details.aumento) results.push(`Aumento inicial: ${details.aumento}`);
      if (details.tincion) results.push(`Tinción: ${details.tincion}`);
      return results;
    }

    if (origAction === 'upload_unclassified') {
      return ['Subió la placa a la lista de espera (pendiente de clasificación)'];
    }

    if (origAction === 'classify_waiting_plate' || log.action_type === 'classify') {
      const dest = details.subtema_nombre ? ` al subtema "${details.subtema_nombre}"` : '';
      return [`Clasificó la placa desde la lista de espera y la asignó${dest}`];
    }

    if (origAction === 'delete_classified' || log.action_type === 'delete') {
      return [`Eliminó la placa "${log.entity_name}" del catálogo`];
    }

    if (origAction === 'delete_unclassified') {
      return ['Eliminó la placa pendiente de la lista de espera'];
    }

    if (origAction === 'move' || details.source === 'mover_placa') {
      const toName = details.subtema_nombre || details.to_subtema_nombre;
      return [toName ? `Movió la placa al subtema "${toName}"` : 'Reubicó la placa a otro subtema'];
    }

    if (log.action_type === 'reorder') {
      return ['Reordenó la posición de la placa en la lista'];
    }

    // Edición de placa: inspeccionar changed_fields si existe
    const changed = details.changed_fields as Record<string, any> | undefined;
    if (changed) {
      if (changed.photo_url) results.push('Actualizó la fotografía de la placa');
      if (changed.aumento) results.push(`Modificó el aumento a "${changed.aumento}"`);
      if (changed.tincion) results.push(`Modificó la tinción a "${changed.tincion}"`);
      if (changed.comentario) results.push('Actualizó las notas / comentario clínico');
      if (Array.isArray(changed.senalados)) {
        results.push(`Actualizó la configuración de señalados (${changed.senalados.length} señalados activos)`);
      }
      if (results.length > 0) return results;
    }

    return ['Actualizó la información y señalados de la placa'];
  }

  // 3. Registros de páginas
  if (log.entity_type === 'pagina') {
    if (log.action_type === 'publish') return ['Publicó una nueva versión de la página con los cambios más recientes'];
    if (log.action_type === 'restore') return ['Restauró la página a una versión previa guardada'];
    return ['Guardó borrador con modificaciones en los bloques de contenido de la página'];
  }

  // 4. Registros de pruebas / evaluaciones
  if (log.entity_type === 'prueba') {
    if (log.action_type === 'create') return ['Creó una nueva prueba de evaluación'];
    if (log.action_type === 'publish') return ['Publicó la prueba para su acceso'];
    if (log.action_type === 'delete') return ['Eliminó la prueba de evaluación'];
    return ['Modificó las preguntas y configuración de la prueba'];
  }

  // 5. Registros de temas y subtemas
  if (log.entity_type === 'tema' || log.entity_type === 'subtema') {
    const label = log.entity_type === 'tema' ? 'el tema' : 'el subtema';
    if (log.action_type === 'create') return [`Creó ${label} "${log.entity_name}"`];
    if (log.action_type === 'delete') return [`Eliminó ${label} "${log.entity_name}"`];
    return [`Actualizó la configuración de ${label} "${log.entity_name}"`];
  }

  // 6. Registros de mapas interactivos
  if (log.entity_type === 'mapa') {
    return ['Actualizó las zonas interactivas y polígonos del mapa'];
  }

  // 7. Registros de usuarios
  if (log.entity_type === 'usuario') {
    if (log.action_type === 'create') return ['Creó una nueva cuenta de usuario en el sistema'];
    if (log.action_type === 'delete') return ['Eliminó la cuenta de usuario'];
    if (log.action_type === 'role_change') return ['Modificó el rol de permisos del usuario'];
    return ['Actualizó los datos de la cuenta del usuario'];
  }

  // Fallback general
  return [`Realizó cambios en ${log.entity_type}: "${log.entity_name}"`];
};
