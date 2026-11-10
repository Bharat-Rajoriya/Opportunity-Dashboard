const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')

function importedStyles() {
  const app = readFileSync(join(__dirname, '..', '..', 'src', 'App.jsx'), 'utf8')
  return [...app.matchAll(/^import ['"]([^'"]+\.css)['"]$/gm)].map(match => match[1])
}

/**
 * Guard the *relative precedence* of theme layers, not whether some old
 * stylesheet remains last forever. Future scoped fixes are allowed.
 */
function assertStylesInOrder(...styles) {
  const imports = importedStyles()
  let previous = -1
  for (const style of styles) {
    const index = imports.indexOf(style)
    assert(index >= 0, `Missing stylesheet import: ${style}`)
    assert(index > previous, `Stylesheet ${style} must follow earlier listed layers`)
    previous = index
  }
}

module.exports = { assertStylesInOrder, importedStyles }
