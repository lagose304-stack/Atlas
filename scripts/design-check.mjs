#!/usr/bin/env node
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(scriptPath), '..');

export const CONTRACT_FILES = [
  '.agents/rules/design-quality.md',
  '.agents/skills/diseno-web/SKILL.md',
  '.agents/skills/diseno-web/agents/openai.yaml',
  'docs/diseno-web.md',
  'AGENTS.md',
  'CLAUDE.md',
  '.cursor/rules/diseno-web.mdc',
  '.github/copilot-instructions.md',
  'GEMINI.md',
  '.windsurfrules',
  'scripts/design-check.mjs',
];

export function isDesignFile(file) {
  return file.startsWith('src/')
    && /\.(tsx|jsx|css|scss|html)$/i.test(file)
    && !/\.(test|spec)\./i.test(file);
}

function add(list, message) {
  if (!list.includes(message)) list.push(message);
}

export function auditAddedLines(entries, reducedMotionSources = '') {
  const issues = [];
  const warnings = [];
  const hasReducedMotion = /prefers-reduced-motion/.test(reducedMotionSources);

  for (const { file, text } of entries) {
    const line = text.trim();
    if (!line || line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) continue;

    if (/https?:\/\/\S*cloudinary\S*/i.test(line)) {
      add(issues, `${file}: referencia nueva a Cloudinary; Atlas usa solo R2.`);
    }
    if (/@import\s+(?:url\(|["']https?:)/i.test(line)) {
      add(issues, `${file}: import externo de CSS/fuentes; usa assets locales o estilos del repositorio.`);
    }
    if (/<link\b[^>]*href=["']https?:\/\/fonts\.(?:googleapis|gstatic)\.com/i.test(line)) {
      add(issues, `${file}: enlace nuevo a Google Fonts; usa las fuentes locales de Atlas.`);
    }
    if (/animation\s*:[^;]*\binfinite\b/i.test(line) || /animation-iteration-count\s*:\s*infinite/i.test(line)) {
      if (!hasReducedMotion) {
        add(issues, `${file}: animación infinita sin prefers-reduced-motion.`);
      } else {
        add(warnings, `${file}: animación infinita; confirma que aporta algo y respeta movimiento reducido.`);
      }
    }
    if (/(?:^|[;{\s])(?:animation|transition)\s*:/i.test(line) && !hasReducedMotion) {
      add(warnings, `${file}: se añadió movimiento sin regla prefers-reduced-motion.`);
    }
    if (/font-size\s*:\s*(?:\d|1[01])(?:\.\d+)?px/i.test(line)) {
      add(warnings, `${file}: tamaño de fuente menor que 12 px; revisa legibilidad.`);
    }
    if (/backdrop-filter\s*:/i.test(line)) {
      add(warnings, `${file}: backdrop-filter puede encarecer el compositor; justifícalo.`);
    }
    if (/\b!important\b/i.test(line)) {
      add(warnings, `${file}: !important añadido; revisa la cascada antes de cerrar.`);
    }
    if (/\.(css|scss)$/i.test(file) && /#[0-9a-f]{3,8}\b/i.test(line)) {
      add(warnings, `${file}: color literal añadido; prefiere variables del ámbito existente.`);
    }
    if (/<img\b(?![^>]*\balt\s*=)[^>]*>/i.test(line)) {
      add(warnings, `${file}: etiqueta img añadida sin alt.`);
    }
    if (/target\s*=\s*["']_blank["']/i.test(line) && !/rel\s*=/.test(line)) {
      add(warnings, `${file}: enlace nuevo sin rel para target="_blank".`);
    }
    if (/linear-gradient\([^;]*(?:#7c3aed|#8b5cf6|#6366f1|purple|violet)/i.test(line)
      || /(?:purple|violet)[-\s]*(?:to[-\s]*)?blue/i.test(line)) {
      add(warnings, `${file}: degradado genérico morado/azul; revisa la dirección de arte.`);
    }
  }

  return { issues, warnings };
}

function runGit(args, cwd) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export function getChangedFiles(cwd = root) {
  try {
    const tracked = runGit(['diff', '--name-only', '--diff-filter=ACMR', 'HEAD'], cwd)
      .split('\n').filter(Boolean);
    const untracked = runGit(['ls-files', '--others', '--exclude-standard'], cwd)
      .split('\n').filter(Boolean);
    return {
      files: [...new Set([...tracked, ...untracked])].map((file) => file.replace(/\\/g, '/')),
      untracked: new Set(untracked.map((file) => file.replace(/\\/g, '/'))),
      error: null,
    };
  } catch (error) {
    return { files: [], untracked: new Set(), error: String(error?.message ?? error) };
  }
}

export function collectAddedLines(files, untracked, cwd = root) {
  const entries = [];
  const tracked = files.filter((file) => !untracked.has(file));

  if (tracked.length) {
    const diff = runGit(['diff', '--unified=0', 'HEAD', '--', ...tracked], cwd);
    let current = '';
    for (const line of diff.split(/\r?\n/)) {
      if (line.startsWith('+++ b/')) {
        current = line.slice(6).replace(/\\/g, '/');
      } else if (line.startsWith('+') && !line.startsWith('+++') && current) {
        entries.push({ file: current, text: line.slice(1) });
      }
    }
  }

  for (const file of files.filter((item) => untracked.has(item))) {
    const absolute = path.join(cwd, file);
    if (!existsSync(absolute)) continue;
    for (const text of readFileSync(absolute, 'utf8').split(/\r?\n/)) {
      entries.push({ file, text });
    }
  }

  return entries;
}

function checkContract(cwd) {
  const issues = [];
  for (const file of CONTRACT_FILES) {
    if (!existsSync(path.join(cwd, file))) {
      issues.push(`Falta el archivo del contrato: ${file}`);
    }
  }
  try {
    const pkg = JSON.parse(readFileSync(path.join(cwd, 'package.json'), 'utf8'));
    if (pkg.scripts?.['design:check'] !== 'node scripts/design-check.mjs') {
      issues.push('package.json no declara design:check correctamente.');
    }
  } catch {
    issues.push('No se pudo leer package.json.');
  }
  return issues;
}

function findImpeccable(cwd) {
  const override = process.env.IMPECCABLE_BIN;
  if (override && existsSync(override)) return override;
  const names = process.platform === 'win32'
    ? ['impeccable.cmd', 'impeccable']
    : ['impeccable'];
  for (const name of names) {
    const candidate = path.join(cwd, 'node_modules', '.bin', name);
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function runImpeccable(binary, files, cwd) {
  const result = spawnSync(binary, ['detect', ...files], {
    cwd,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    windowsHide: true,
  });
  if (result.error) return { status: 1, error: String(result.error.message ?? result.error) };
  return { status: result.status ?? 1, error: null };
}

function printList(title, items, limit = 12) {
  if (!items.length) return;
  console.log(`\n${title}`);
  for (const item of items.slice(0, limit)) console.log(`  - ${item}`);
  if (items.length > limit) console.log(`  - ... y ${items.length - limit} más`);
}

export function main(argv = process.argv.slice(2)) {
  const strict = argv.includes('--strict');
  const issues = checkContract(root);
  const warnings = [];
  const notes = [];

  const changed = getChangedFiles(root);
  if (changed.error) issues.push(`No se pudo consultar git: ${changed.error}`);

  const designFiles = changed.files.filter(isDesignFile);
  notes.push(`Archivos de diseño cambiados: ${designFiles.length}`);

  if (designFiles.length) {
    const entries = collectAddedLines(designFiles, changed.untracked, root);
    const reducedMotionSources = [
      ...designFiles.filter((file) => /\.(css|scss)$/i.test(file)).map((file) => {
        const absolute = path.join(root, file);
        return existsSync(absolute) ? readFileSync(absolute, 'utf8') : '';
      }),
      existsSync(path.join(root, 'src/style.css'))
        ? readFileSync(path.join(root, 'src/style.css'), 'utf8')
        : '',
    ].join('\n');

    const audit = auditAddedLines(entries, reducedMotionSources);
    issues.push(...audit.issues);
    warnings.push(...audit.warnings);

    const binary = findImpeccable(root);
    if (binary) {
      notes.push(`Detector de Impeccable: ${path.relative(root, binary)}`);
      console.log('\nImpeccable detect...');
      const result = runImpeccable(binary, designFiles, root);
      if (result.status === 2) {
        issues.push('Impeccable detectó hallazgos en los archivos de diseño cambiados.');
      } else if (result.status !== 0) {
        issues.push(`Impeccable detect no se pudo completar: ${result.error ?? `salida ${result.status}`}`);
      } else {
        notes.push('Impeccable detect: sin hallazgos.');
      }
    } else {
      const message = 'Impeccable detect no está instalado; ejecuta npx impeccable install o usa design:check:strict para exigirlo.';
      if (strict) issues.push(message);
      else warnings.push(message);
    }

    notes.push('Taste requiere revisión en navegador; consulta docs/diseno-web.md con el dev server activo.');
  }

  console.log('Atlas design:check');
  printList('Notas', notes);
  printList('Advertencias', warnings);
  printList('Fallos', issues);

  if (issues.length) {
    console.log('\nRESULTADO: FAIL');
    process.exitCode = 1;
  } else {
    console.log('\nRESULTADO: PASS');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) main();
