import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  logAuditEvent,
  fetchAuditLogs,
  calculateAuditMetrics,
  exportAuditLogsToCsv,
  exportAuditLogsToJson,
  countAuditLogsForPurge,
  purgeAuditLogs,
  deleteAuditLogsByIds,
  fetchTemaAuditLogs,
  fetchSubtemaAuditLogs,
  fetchPlacaAuditLogs,
  fetchPruebaAuditLogs,
  type AuditLogEntry,
} from './unifiedAuditService';

// Mock storage
const store: Record<string, string> = {};
const mockLocalStorage = {
  getItem: vi.fn((key: string) => store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  }),
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

// Mock supabase to test fallback engine in unit tests
vi.mock('./supabase', () => ({
  supabase: {
    from: () => ({
      select: () => {
        throw new Error('Supabase no disponible en entorno de test unitario');
      },
      insert: () => {
        throw new Error('Supabase no disponible en entorno de test unitario');
      },
      delete: () => {
        throw new Error('Supabase no disponible en entorno de test unitario');
      },
    }),
    rpc: () => {
      throw new Error('RPC no disponible en entorno de test unitario');
    },
  },
}));

describe('unifiedAuditService', () => {
  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
  });

  it('debe registrar y recuperar eventos de auditoría con fallback local', async () => {
    await logAuditEvent({
      entityType: 'placa',
      actionType: 'classify',
      entityId: '42',
      entityName: 'Placa #42 - Tejido Epitelial',
      actor: {
        id: 5,
        username: 'drlagos',
        name: 'Dr. Lagos',
        role: 'Administrador',
      },
      details: {
        photo_url: 'https://res.cloudinary.com/test/image/upload/v1/sample.jpg',
        subtema_id: 10,
        subtema_nombre: 'Tejido Epitelial Cúbico',
        tema_id: 2,
        tema_nombre: 'Epitelios',
        aumento: '40x',
        tincion: 'H&E',
      },
    });

    const result = await fetchAuditLogs();
    expect(result.logs.length).toBeGreaterThan(0);
    const entry = result.logs[0];
    expect(entry.actor_name).toBe('Dr. Lagos');
    expect(entry.entity_name).toBe('Placa #42 - Tejido Epitelial');
    expect(entry.details.subtema_nombre).toBe('Tejido Epitelial Cúbico');
  });

  it('debe filtrar logs por subtemaId y subtemaNombre', async () => {
    await logAuditEvent({
      entityType: 'placa',
      actionType: 'create',
      entityId: '101',
      entityName: 'Placa #101 - Neuronas',
      actor: { name: 'Dra. Gomez', username: 'dgomez' },
      details: {
        subtema_id: 55,
        subtema_nombre: 'Neuronas Multipolares',
        tema_nombre: 'Sistema Nervioso',
      },
    });

    await logAuditEvent({
      entityType: 'placa',
      actionType: 'update',
      entityId: '102',
      entityName: 'Placa #102 - Hígado',
      actor: { name: 'Dr. Lagos', username: 'drlagos' },
      details: {
        subtema_id: 88,
        subtema_nombre: 'Lobulillo Hepático',
        tema_nombre: 'Aparato Digestivo',
      },
    });

    // Filtrar por subtemaId 55
    const resId = await fetchAuditLogs({ subtemaId: 55 });
    expect(resId.logs.length).toBe(1);
    expect(resId.logs[0].entity_id).toBe('101');

    // Buscar por texto de subtema "hepático"
    const resSearch = await fetchAuditLogs({ searchQuery: 'hepático' });
    expect(resSearch.logs.length).toBe(1);
    expect(resSearch.logs[0].entity_id).toBe('102');
  });

  it('debe calcular métricas de auditoría correctamente', () => {
    const mockLogs: AuditLogEntry[] = [
      {
        id: 1,
        created_at: new Date().toISOString(),
        entity_type: 'placa',
        action_type: 'create',
        entity_id: '1',
        entity_name: 'Placa #1',
        actor_user_id: 1,
        actor_username: 'drlagos',
        actor_name: 'Dr. Lagos',
        actor_role: 'Admin',
        details: {},
        ip_address: null,
      },
      {
        id: 2,
        created_at: new Date().toISOString(),
        entity_type: 'placa',
        action_type: 'delete',
        entity_id: '2',
        entity_name: 'Placa #2',
        actor_user_id: 1,
        actor_username: 'drlagos',
        actor_name: 'Dr. Lagos',
        actor_role: 'Admin',
        details: {},
        ip_address: null,
      },
    ];

    const metrics = calculateAuditMetrics(mockLogs);
    expect(metrics.totalCount).toBe(2);
    expect(metrics.todayCount).toBe(2);
    expect(metrics.criticalCount).toBe(1);
    expect(metrics.activeEditorsCount).toBe(1);
  });

  it('debe exportar registros a CSV y JSON correctamente', () => {
    const mockLogs: AuditLogEntry[] = [
      {
        id: 1,
        created_at: '2026-08-21T10:00:00.000Z',
        entity_type: 'placa',
        action_type: 'create',
        entity_id: '12',
        entity_name: 'Placa #12 - Hígado',
        actor_user_id: 2,
        actor_username: 'drlagos',
        actor_name: 'Dr. Lagos',
        actor_role: 'Admin',
        details: { subtema_nombre: 'Hígado', aumento: '40x' },
        ip_address: null,
      },
    ];

    const csv = exportAuditLogsToCsv(mockLogs);
    expect(csv).toContain('Placa #12 - Hígado');
    expect(csv).toContain('Dr. Lagos');

    const json = exportAuditLogsToJson(mockLogs);
    expect(json).toContain('"entity_name": "Placa #12 - Hígado"');
  });

  it('debe contar y purgar registros de auditoría por rangos de fecha y categorías', async () => {
    // Guardar registros
    await logAuditEvent({
      entityType: 'sesion',
      actionType: 'login',
      entityId: 'sesion-1',
      entityName: 'Inicio de sesión',
      actor: { name: 'Dr. Lagos' },
      details: {},
    });

    await logAuditEvent({
      entityType: 'placa',
      actionType: 'create',
      entityId: 'placa-50',
      entityName: 'Placa #50',
      actor: { name: 'Dr. Lagos' },
      details: {},
    });

    const todayStr = new Date().toISOString().slice(0, 10);

    // Contar registros para purga
    const countAll = await countAuditLogsForPurge({ dateFrom: todayStr, dateTo: todayStr });
    expect(countAll).toBe(2);

    const countSesiones = await countAuditLogsForPurge({
      dateFrom: todayStr,
      dateTo: todayStr,
      entityType: 'sesion',
    });
    expect(countSesiones).toBe(1);

    // Purgar sólo sesiones
    const purgeRes = await purgeAuditLogs({
      dateFrom: todayStr,
      dateTo: todayStr,
      entityType: 'sesion',
    });
    expect(purgeRes.count).toBe(1);

    // Verificar que queda 1 registro (la placa)
    const remaining = await fetchAuditLogs();
    expect(remaining.logs.length).toBe(1);
    expect(remaining.logs[0].entity_type).toBe('placa');
  });

  it('debe eliminar registros individuales por ID', async () => {
    await logAuditEvent({
      entityType: 'prueba',
      actionType: 'create',
      entityId: 'test-1',
      entityName: 'Evaluación Parcial',
      actor: { name: 'Dr. Lagos' },
      details: {},
    });

    const before = await fetchAuditLogs();
    expect(before.logs.length).toBe(1);
    const logId = before.logs[0].id;

    const delRes = await deleteAuditLogsByIds([logId]);
    expect(delRes.count).toBe(1);

    const after = await fetchAuditLogs();
    expect(after.logs.length).toBe(0);
  });

  it('debe filtrar exclusivamente contenido de página y tema en fetchTemaAuditLogs excluyendo placas', async () => {
    // Registro de página de tema
    await logAuditEvent({
      entityType: 'pagina',
      actionType: 'update',
      entityId: '5',
      entityName: 'Página: Tema Tejido Epitelial',
      actor: { name: 'Dr. Lagos' },
      details: { tema_id: 5, blocks_count: 8 },
    });

    // Registro de placa en el mismo tema
    await logAuditEvent({
      entityType: 'placa',
      actionType: 'create',
      entityId: '99',
      entityName: 'Placa #99',
      actor: { name: 'Dr. Lagos' },
      details: { tema_id: 5 },
    });

    const temaAudit = await fetchTemaAuditLogs(5, 'Tejido Epitelial');
    expect(temaAudit.logs.length).toBe(1);
    expect(temaAudit.logs[0].entity_type).toBe('pagina');
    expect(temaAudit.logs[0].entity_id).toBe('5');
  });

  it('debe filtrar exclusivamente contenido de página y subtema en fetchSubtemaAuditLogs excluyendo placas', async () => {
    await logAuditEvent({
      entityType: 'subtema',
      actionType: 'update',
      entityId: '22',
      entityName: 'Subtema: Epitelio Cilíndrico',
      actor: { name: 'Dr. Lagos' },
      details: { subtema_id: 22 },
    });

    await logAuditEvent({
      entityType: 'placa',
      actionType: 'create',
      entityId: '77',
      entityName: 'Placa #77',
      actor: { name: 'Dr. Lagos' },
      details: { subtema_id: 22 },
    });

    const subtemaAudit = await fetchSubtemaAuditLogs(22, 'Epitelio Cilíndrico');
    expect(subtemaAudit.logs.length).toBe(1);
    expect(subtemaAudit.logs[0].entity_type).toBe('subtema');
    expect(subtemaAudit.logs[0].entity_id).toBe('22');
  });

  it('debe filtrar exclusivamente registros de una placa específica en fetchPlacaAuditLogs', async () => {
    await logAuditEvent({
      entityType: 'placa',
      actionType: 'update',
      entityId: '404',
      entityName: 'Placa #404 - Riñón',
      actor: { name: 'Dr. Lagos' },
      details: { aumento: '40x' },
    });

    await logAuditEvent({
      entityType: 'placa',
      actionType: 'update',
      entityId: '505',
      entityName: 'Placa #505 - Piel',
      actor: { name: 'Dra. Gomez' },
      details: { aumento: '10x' },
    });

    const placaAudit = await fetchPlacaAuditLogs(404);
    expect(placaAudit.logs.length).toBe(1);
    expect(placaAudit.logs[0].entity_id).toBe('404');
    expect(placaAudit.logs[0].entity_name).toBe('Placa #404 - Riñón');
  });

  it('debe filtrar exclusivamente registros de una evaluación específica en fetchPruebaAuditLogs', async () => {
    await logAuditEvent({
      entityType: 'prueba',
      actionType: 'update',
      entityId: 'eval-1',
      entityName: 'Prueba: Examen Parcial 1',
      actor: { name: 'Dr. Lagos' },
      details: { preguntas_count: 10 },
    });

    await logAuditEvent({
      entityType: 'prueba',
      actionType: 'create',
      entityId: 'eval-2',
      entityName: 'Prueba: Examen Parcial 2',
      actor: { name: 'Dr. Lagos' },
      details: { preguntas_count: 15 },
    });

    const pruebaAudit = await fetchPruebaAuditLogs('eval-1', 'Examen Parcial 1');
    expect(pruebaAudit.logs.length).toBe(1);
    expect(pruebaAudit.logs[0].entity_id).toBe('eval-1');
  });
});
