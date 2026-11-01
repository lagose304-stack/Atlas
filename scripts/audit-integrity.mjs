// Auditoría de solo lectura; los hallazgos no autorizan limpiezas.
import { runMediaAudit, auditFailed } from './lib/run-media-audit.mjs';

runMediaAudit('integrity').catch(auditFailed);
