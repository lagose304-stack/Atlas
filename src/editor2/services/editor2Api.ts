import { z } from 'zod';
import { supabase } from '../../services/supabase';
import { canvasDocSchema, pageKeySchema, rootPlacedBlockSchema, type BlockStyle, type CanvasDoc, type PlacedBlock } from '../domain/schema';
import { blockStyleSchema } from '../domain/styleSchema';

const uuidSchema = z.uuid();
const isoDateSchema = z.string().min(1);

export type Editor2ApiErrorCode =
  | 'unauthorized'
  | 'validation'
  | 'conflict'
  | 'not_found'
  | 'network'
  | 'unknown';

export class Editor2ApiError extends Error {
  readonly code: Editor2ApiErrorCode;
  readonly cause?: unknown;

  constructor(code: Editor2ApiErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'Editor2ApiError';
    this.code = code;
    this.cause = cause;
  }
}

export const editor2PageRecordSchema = z.strictObject({
  pageKey: pageKeySchema,
  title: z.string().min(1),
  section: z.string().min(1),
  publicPath: z.string().min(1),
  description: z.string(),
  keywords: z.array(z.string()),
  kind: z.enum(['fixed', 'tema', 'subtema']),
  parentPageKey: pageKeySchema.nullable().optional(),
  parcial: z.string().nullable().optional(),
  sortOrder: z.number().int(),
  enabled: z.boolean(),
  hasDraft: z.boolean(),
  draftUpdatedAt: isoDateSchema.nullable(),
  publishedVersionId: uuidSchema.nullable(),
  publishedVersionNumber: z.number().int().positive().nullable(),
  publishedAt: isoDateSchema.nullable(),
});

export const editor2UpsertPageInputSchema = z.strictObject({
  pageKey: pageKeySchema,
  title: z.string().min(1),
  section: z.string().min(1),
  publicPath: z.string().min(1),
  description: z.string().default(''),
  keywords: z.array(z.string()).default([]),
  kind: z.enum(['fixed', 'tema', 'subtema']).default('fixed'),
  parentPageKey: pageKeySchema.nullable().optional(),
  parcial: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
  enabled: z.boolean().optional(),
});

export const editor2DraftRecordSchema = z.strictObject({
  pageKey: pageKeySchema,
  doc: canvasDocSchema,
  baseVersionId: uuidSchema.nullable(),
  actorId: z.number().int().nullable(),
  updatedAt: isoDateSchema,
});

export const editor2VersionSummarySchema = z.strictObject({
  id: uuidSchema,
  pageKey: pageKeySchema,
  versionNumber: z.number().int().positive(),
  label: z.string(),
  source: z.enum(['draft', 'version', 'empty']),
  actorId: z.number().int().nullable(),
  createdAt: isoDateSchema,
  isPublished: z.boolean(),
});

export const editor2PublicationRecordSchema = z.strictObject({
  pageKey: pageKeySchema,
  versionId: uuidSchema,
  versionNumber: z.number().int().positive(),
  label: z.string(),
  actorId: z.number().int().nullable(),
  publishedAt: isoDateSchema,
});

export const editor2WorkspaceSchema = z.strictObject({
  pageKey: pageKeySchema,
  draft: editor2DraftRecordSchema.nullable(),
  versions: z.array(editor2VersionSummarySchema),
  publication: editor2PublicationRecordSchema.nullable(),
});

export const editor2PublicDocSchema = z.strictObject({
  pageKey: pageKeySchema,
  versionId: uuidSchema,
  versionNumber: z.number().int().positive(),
  publishedAt: isoDateSchema,
  doc: canvasDocSchema,
});

export type Editor2PageRecord = z.infer<typeof editor2PageRecordSchema>;
export type Editor2UpsertPageInput = z.infer<typeof editor2UpsertPageInputSchema>;
export type Editor2DraftRecord = z.infer<typeof editor2DraftRecordSchema>;
export type Editor2VersionSummary = z.infer<typeof editor2VersionSummarySchema>;
export type Editor2PublicationRecord = z.infer<typeof editor2PublicationRecordSchema>;
export type Editor2WorkspaceData = z.infer<typeof editor2WorkspaceSchema>;
export type Editor2PublicDoc = z.infer<typeof editor2PublicDocSchema>;

export type Editor2RpcClient = {
  rpc: (
    fn: string,
    params?: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string; details?: string } | null }>;
};

function classifyRpcError(error: { code?: string; message?: string; details?: string }): Editor2ApiError {
  const code = (error.code ?? '').toLowerCase();
  const message = error.message ?? 'Error al comunicar con Editor 2.0.';
  const blob = `${code} ${message} ${error.details ?? ''}`.toLowerCase();

  if (code === '28000' || blob.includes('editor2_unauthorized') || blob.includes('sesión')) {
    return new Editor2ApiError('unauthorized', 'Tu sesión de Atlas no es válida o no tiene permisos de edición.', error);
  }
  if (code === '23503' || blob.includes('editor2_conflict')) {
    return new Editor2ApiError('conflict', message, error);
  }
  if (code === 'p0002' || blob.includes('editor2_not_found')) {
    return new Editor2ApiError('not_found', message, error);
  }
  if (code === '22023' || blob.includes('editor2_validation')) {
    return new Editor2ApiError('validation', message, error);
  }
  if (blob.includes('failed to fetch') || blob.includes('network') || blob.includes('timeout')) {
    return new Editor2ApiError('network', 'Error de red al conectar con Supabase.', error);
  }
  return new Editor2ApiError('unknown', message, error);
}

async function callRpc<T>(
  client: Editor2RpcClient,
  fn: string,
  params: Record<string, unknown> | undefined,
  schema: z.ZodType<T>,
): Promise<T> {
  let response: { data: unknown; error: { code?: string; message?: string; details?: string } | null };
  try {
    response = await client.rpc(fn, params);
  } catch (err) {
    throw new Editor2ApiError('network', 'No se pudo completar la solicitud al servidor.', err);
  }

  if (response.error) {
    throw classifyRpcError(response.error);
  }

  const parsed = schema.safeParse(response.data);
  if (!parsed.success) {
    throw new Editor2ApiError(
      'validation',
      `La respuesta de ${fn} no cumple el contrato de Editor 2.0.`,
      parsed.error,
    );
  }
  return parsed.data;
}

function validatePageKey(pageKey: string): string {
  const parsed = pageKeySchema.safeParse(pageKey);
  if (!parsed.success) {
    throw new Editor2ApiError('validation', 'La clave de página (pageKey) no es válida.', parsed.error);
  }
  return parsed.data;
}

function validateDoc(pageKey: string, doc: CanvasDoc): CanvasDoc {
  const parsed = canvasDocSchema.safeParse(doc);
  if (!parsed.success) {
    throw new Editor2ApiError(
      'validation',
      'El documento no cumple el contrato del Editor 2.0 (versión de esquema o bloques inválidos).',
      parsed.error,
    );
  }
  if (parsed.data.pageKey !== pageKey) {
    throw new Editor2ApiError(
      'validation',
      'El pageKey del documento no coincide con la página destino.',
    );
  }
  return parsed.data;
}

export function createEditor2Api(client: Editor2RpcClient = supabase as unknown as Editor2RpcClient) {
  return {
    async listPages(): Promise<Editor2PageRecord[]> {
      return callRpc(client, 'editor2_list_pages', undefined, z.array(editor2PageRecordSchema));
    },

    async upsertPages(pages: Editor2UpsertPageInput[]): Promise<{ ok: true; count: number }> {
      const parsedPages = z.array(editor2UpsertPageInputSchema).safeParse(pages);
      if (!parsedPages.success) {
        throw new Editor2ApiError('validation', 'Los metadatos del índice no son válidos.', parsedPages.error);
      }
      return callRpc(
        client,
        'editor2_upsert_pages',
        { p_pages: parsedPages.data },
        z.strictObject({ ok: z.literal(true), count: z.number().int().nonnegative() }),
      );
    },

    async getWorkspace(pageKey: string): Promise<Editor2WorkspaceData> {
      const safeKey = validatePageKey(pageKey);
      return callRpc(client, 'editor2_get_workspace', { p_page_key: safeKey }, editor2WorkspaceSchema);
    },

    async saveDraft(
      pageKey: string,
      doc: CanvasDoc,
      baseVersionId: string | null = null,
    ): Promise<Editor2DraftRecord> {
      const safeKey = validatePageKey(pageKey);
      const safeDoc = validateDoc(safeKey, doc);
      if (baseVersionId !== null && !uuidSchema.safeParse(baseVersionId).success) {
        throw new Editor2ApiError('validation', 'El identificador de versión base no es válido.');
      }
      return callRpc(
        client,
        'editor2_save_draft',
        { p_page_key: safeKey, p_doc: safeDoc, p_base_version_id: baseVersionId },
        editor2DraftRecordSchema,
      );
    },

    async createVersion(
      pageKey: string,
      options: { label?: string; source?: 'draft' | 'version' | 'empty'; sourceVersionId?: string | null } = {},
    ): Promise<Editor2VersionSummary> {
      const safeKey = validatePageKey(pageKey);
      const source = options.source ?? 'draft';
      const sourceVersionId = options.sourceVersionId ?? null;
      if (source === 'version' && (!sourceVersionId || !uuidSchema.safeParse(sourceVersionId).success)) {
        throw new Editor2ApiError('validation', 'Se requiere un UUID válido de versión origen.');
      }
      return callRpc(
        client,
        'editor2_create_version',
        {
          p_page_key: safeKey,
          p_label: options.label ?? '',
          p_source: source,
          p_source_version_id: sourceVersionId,
        },
        editor2VersionSummarySchema,
      );
    },

    async publishDraft(pageKey: string, label = ''): Promise<Editor2PublicationRecord> {
      const safeKey = validatePageKey(pageKey);
      return callRpc(
        client,
        'editor2_publish_draft',
        { p_page_key: safeKey, p_label: label },
        editor2PublicationRecordSchema,
      );
    },

    async publishVersion(pageKey: string, versionId: string): Promise<Editor2PublicationRecord> {
      const safeKey = validatePageKey(pageKey);
      if (!uuidSchema.safeParse(versionId).success) {
        throw new Editor2ApiError('validation', 'El identificador de versión no es un UUID válido.');
      }
      return callRpc(
        client,
        'editor2_publish_version',
        { p_page_key: safeKey, p_version_id: versionId },
        editor2PublicationRecordSchema,
      );
    },

    async deleteVersion(pageKey: string, versionId: string): Promise<{ ok: true; deletedVersionId: string }> {
      const safeKey = validatePageKey(pageKey);
      if (!uuidSchema.safeParse(versionId).success) {
        throw new Editor2ApiError('validation', 'El identificador de versión no es un UUID válido.');
      }
      return callRpc(
        client,
        'editor2_delete_version',
        { p_page_key: safeKey, p_version_id: versionId },
        z.strictObject({ ok: z.literal(true), deletedVersionId: uuidSchema }),
      );
    },

    async unpublishPage(pageKey: string): Promise<{ ok: true; pageKey: string; unpublished: boolean }> {
      const safeKey = validatePageKey(pageKey);
      return callRpc(
        client,
        'editor2_unpublish_page',
        { p_page_key: safeKey },
        z.strictObject({ ok: z.literal(true), pageKey: pageKeySchema, unpublished: z.boolean() }),
      );
    },

    async getPublicDoc(pageKey: string): Promise<Editor2PublicDoc | null> {
      const safeKey = validatePageKey(pageKey);
      return callRpc(
        client,
        'editor2_get_public_doc',
        { p_page_key: safeKey },
        editor2PublicDocSchema.nullable(),
      );
    },

    async listPresets(): Promise<Editor2StylePresetRecord[]> {
      return callRpc(client, 'editor2_list_presets', {}, z.array(editor2StylePresetSchema));
    },

    async savePreset(name: string, style: BlockStyle): Promise<Editor2StylePresetRecord> {
      const cleanName = name.trim();
      if (!cleanName || cleanName.length > 80) {
        throw new Editor2ApiError('validation', 'El nombre del preset debe tener entre 1 y 80 caracteres.');
      }
      const parsedStyle = blockStyleSchema.safeParse(style);
      if (!parsedStyle.success) {
        throw new Editor2ApiError('validation', 'El estilo del preset no cumple el contrato.');
      }
      const rows = await callRpc(
        client,
        'editor2_save_preset',
        { p_name: cleanName, p_style: parsedStyle.data },
        z.array(editor2StylePresetSchema).min(1),
      );
      return rows[0];
    },

    async deletePreset(id: string): Promise<boolean> {
      if (!uuidSchema.safeParse(id).success) {
        throw new Editor2ApiError('validation', 'Identificador de preset inválido.');
      }
      return callRpc(client, 'editor2_delete_preset', { p_id: id }, z.boolean());
    },

    async listTemplates(): Promise<Editor2SectionTemplateRecord[]> {
      return callRpc(client, 'editor2_list_templates', {}, z.array(editor2SectionTemplateSchema));
    },

    async saveTemplate(input: {
      name: string;
      category?: string;
      description?: string;
      section: PlacedBlock;
    }): Promise<Editor2SectionTemplateRecord> {
      const cleanName = input.name.trim();
      if (!cleanName || cleanName.length > 100) {
        throw new Editor2ApiError('validation', 'El nombre de la plantilla debe tener entre 1 y 100 caracteres.');
      }
      const parsedSection = rootPlacedBlockSchema.safeParse(input.section);
      if (!parsedSection.success) {
        throw new Editor2ApiError('validation', 'La sección no cumple el contrato del editor.');
      }
      const rows = await callRpc(
        client,
        'editor2_save_template',
        {
          p_name: cleanName,
          p_category: (input.category ?? 'Personalizada').trim().slice(0, 48) || 'Personalizada',
          p_description: (input.description ?? '').trim().slice(0, 200),
          p_section: parsedSection.data,
        },
        z.array(editor2SectionTemplateSchema).min(1),
      );
      return rows[0];
    },

    async deleteTemplate(id: string): Promise<boolean> {
      if (!uuidSchema.safeParse(id).success) {
        throw new Editor2ApiError('validation', 'Identificador de plantilla inválido.');
      }
      return callRpc(client, 'editor2_delete_template', { p_id: id }, z.boolean());
    },
  };
}

export const editor2StylePresetSchema = z.strictObject({
  id: uuidSchema,
  name: z.string().min(1).max(80),
  style: blockStyleSchema,
  created_at: z.string(),
});

export const editor2SectionTemplateSchema = z.strictObject({
  id: uuidSchema,
  name: z.string().min(1).max(100),
  category: z.string().min(1).max(48),
  description: z.string().max(200),
  section: rootPlacedBlockSchema,
  created_at: z.string(),
});

export type Editor2StylePresetRecord = z.infer<typeof editor2StylePresetSchema>;
export type Editor2SectionTemplateRecord = z.infer<typeof editor2SectionTemplateSchema>;

export const editor2Api = createEditor2Api();
