// Assemble simulateur.js, eligibilite.js et checklist.js en un script classique (bundle.js),
// chargeable par <script src> depuis file:// où les modules ES échouent.
// Usage : node build-bundle.mjs   (ou npm run build). Expose window.FDIOutils.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MODULES = ['simulateur', 'eligibilite', 'checklist']
const ici = (f) => new URL(f, import.meta.url)

export function assembler() {
  const blocs = MODULES.map((nom) => {
    const source = readFileSync(ici(`${nom}.js`), 'utf8')
    if (/^import\s/m.test(source)) throw new Error(`${nom}.js : les imports ne sont pas gérés par le bundle`)
    const exports = [...source.matchAll(/^export (?:const|let|function) (\w+)/gm)].map((m) => m[1])
    const corps = source.replace(/^export (?=const|let|function)/gm, '')
    return `  ${nom}: (function () {\n${corps}\nreturn { ${exports.join(', ')} }\n})(),`
  })
  return [
    '// Généré par build-bundle.mjs : ne pas modifier à la main.',
    '(function (global) {',
    "'use strict'",
    'global.FDIOutils = {',
    blocs.join('\n'),
    '}',
    '})(typeof globalThis !== "undefined" ? globalThis : window)',
    '',
  ].join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(ici('bundle.js'), assembler())
  console.log('bundle.js écrit')
}
