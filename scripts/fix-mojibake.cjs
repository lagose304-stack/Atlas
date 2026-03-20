const fs = require('fs');
const path = require('path');

const root = path.join(process.cwd(), 'src');

const replacements = new Map([
  ['Ã¡', 'á'], ['Ã©', 'é'], ['Ã­', 'í'], ['Ã³', 'ó'], ['Ãº', 'ú'],
  ['Ã', 'Á'], ['Ã‰', 'É'], ['Ã', 'Í'], ['Ã“', 'Ó'], ['Ãš', 'Ú'],
  ['Ã±', 'ñ'], ['Ã‘', 'Ñ'], ['Ã¼', 'ü'], ['Ãœ', 'Ü'],
  ['Â¿', '¿'], ['Â¡', '¡'], ['Â', ''],
  ['â€”', '—'], ['â€“', '–'], ['â€¢', '•'], ['â†’', '→'], ['â€º', '›'],
  ['â–²', '▲'], ['â–¼', '▼'], ['â–¾', '▾'], ['â–¸', '▸'],
  ['âœ…', '✅'], ['âœ“', '✓'], ['âœï¸', '✏️'], ['âš ï¸', '⚠️'], ['â›”', '⛔'],
  ['âœ”', '✔'], ['âœ–', '✖'], ['â»', '⏻'], ['âŒ', '❌'], ['âœ•', '✕'],
  ['âž•', '➕'], ['â¬‡', '⬇'], ['â ¿', '⠿'], ['â³', '⏳'],
  ['â”€', '─'],
  ['ðŸ”¬', '🔬'], ['ðŸ“‹', '📋'], ['ðŸ“„', '📄'], ['ðŸ’¾', '💾'],
  ['ðŸ“š', '📚'], ['ðŸ“‚', '📂'], ['ðŸ—‘ï¸', '🗑️'], ['ðŸ ', '🏠'],
  ['ðŸ§ª', '🧪'], ['ðŸ‘¥', '👥'], ['ðŸ“ˆ', '📈'], ['ðŸš«', '🚫'],
  ['ðŸ“¤', '📤'], ['ðŸ’¬', '💬'], ['ðŸ”„', '🔄']
]);

const targetExt = /\.(tsx|ts|css|md)$/;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!targetExt.test(entry.name)) continue;

    const original = fs.readFileSync(fullPath, 'utf8');
    let updated = original;
    for (const [from, to] of replacements.entries()) {
      updated = updated.split(from).join(to);
    }
    if (updated !== original) {
      fs.writeFileSync(fullPath, updated, 'utf8');
      console.log('fixed', path.relative(process.cwd(), fullPath));
    }
  }
}

walk(root);
