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
}

export interface PlateComparisonState {
  photo_url?: string | null;
  aumento?: string | null;
  tincion?: string | null;
  comentario?: string | null;
  subtema_nombre?: string | null;
  tema_nombre?: string | null;
  senalados?: string[] | null;
  senalados_meta?: Array<MarkerLocationData | null> | null;
}

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
  const oldLabels = (before.senalados || []).map(s => String(s).trim()).filter(Boolean);
  const newLabels = (after.senalados || []).map(s => String(s).trim()).filter(Boolean);
  const oldMeta = before.senalados_meta || [];
  const newMeta = after.senalados_meta || [];

  // Señalados agregados
  const added = newLabels.filter(nl => !oldLabels.some(ol => ol.toLowerCase() === nl.toLowerCase()));
  added.forEach(lbl => {
    changes.push(`Agregó el señalado "${lbl}"`);
  });

  // Señalados borrados
  const removed = oldLabels.filter(ol => !newLabels.some(nl => nl.toLowerCase() === ol.toLowerCase()));
  removed.forEach(lbl => {
    changes.push(`Borró el señalado "${lbl}"`);
  });

  // Señalados coincidentes que fueron modificados (posición, contorno o zonas de exclusión)
  newLabels.forEach((nl, newIdx) => {
    const oldIdx = oldLabels.findIndex(ol => ol.toLowerCase() === nl.toLowerCase());
    if (oldIdx !== -1) {
      const nm = newMeta[newIdx];
      const om = oldMeta[oldIdx];
      if (nm && om) {
        // ¿Cambió el borde o región?
        const newPts = nm.regionPoints || [];
        const oldPts = om.regionPoints || [];
        const regionChanged =
          newPts.length !== oldPts.length ||
          newPts.some((pt, i) => Math.abs(pt - (oldPts[i] ?? 0)) > 0.005);

        if (regionChanged) {
          changes.push(`Modificó el contorno / borde del señalado "${nl}"`);
        } else {
          // ¿Cambió la posición central o punta de la flecha?
          const xChanged = nm.x != null && om.x != null && Math.abs(nm.x - om.x) > 0.005;
          const yChanged = nm.y != null && om.y != null && Math.abs(nm.y - om.y) > 0.005;
          const startChanged =
            nm.startX != null && om.startX != null &&
            (Math.abs(nm.startX - om.startX) > 0.005 || Math.abs((nm.startY ?? 0) - (om.startY ?? 0)) > 0.005);

          if (xChanged || yChanged || startChanged) {
            changes.push(`Reubicó la posición del señalado "${nl}"`);
          }
        }

        // ¿Cambiaron los huecos/donas de exclusión?
        const newHoles = nm.regionHoles || [];
        const oldHoles = om.regionHoles || [];
        if (newHoles.length !== oldHoles.length) {
          changes.push(`Ajustó las zonas de exclusión (huecos) del señalado "${nl}"`);
        }
      }
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
