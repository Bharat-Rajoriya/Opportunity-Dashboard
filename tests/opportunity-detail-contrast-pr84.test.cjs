const test = require('node:test')
const assert = require('node:assert/strict')
const { readFileSync } = require('node:fs')
const { join } = require('node:path')
const read = path => readFileSync(join(__dirname,'..',path),'utf8')

const lum = h => {
  const components = [1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255)
    .map(v=>v <= 0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4)
  return .2126*components[0]+.7152*components[1]+.0722*components[2]
}
const ratio=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)

test('source link style is applied to anchors, not only buttons',()=>{
  const app=read('src/App.jsx')
  const css=read('src/opportunity-detail-theme-pr84.css')
  assert.match(app,/view\.sourceUrl\s*&&\s*\(\s*<a href=\{view\.sourceUrl\}/)
  assert.match(app,/className="opp-v2-source-action"/)
  assert.match(css,/a\.opp-v2-source-action/)
  assert.match(css,/html\[data-theme="dark"\].*a\.opp-v2-source-action/)
  assert.match(css,/a\.opp-v2-source-action:hover/)
  assert.match(css,/a\.opp-v2-source-action:focus-visible/)
  assert.match(css,/\.opp-v2-source-action svg \{ color:inherit; \}/)
})

test('drawer section uses an explicit opaque themed surface',()=>{
  const app=read('src/App.jsx')
  const css=read('src/opportunity-detail-theme-pr84.css')
  assert.match(app,/className="opportunity-detail-section bg-slate-950\/60/)
  assert.match(css,/\.opp-v31-drawer \.opportunity-detail-section/)
  assert.match(css,/background:var\(--detail-nested\)/)
  assert.match(css,/--detail-surface:#ffffff/)
  assert.match(css,/--detail-nested:#f7f8fd/)
  assert.match(css,/--detail-surface:#111c30/)
  assert.match(css,/--detail-nested:#19263d/)
  assert.match(css,/html\[data-theme="dark"\]/)
  assert.match(css,/\[class\*="bg-slate-950"\]/)
})

test('research and requirements copy is legible and evidence semantics stay distinct',()=>{
  const css=read('src/opportunity-detail-theme-pr84.css')
  for(const selector of ['.text-slate-200','.text-slate-300','.text-slate-400','.text-slate-500','[class*="bg-emerald"]','[class*="bg-amber"]','[class*="bg-rose"]']){
    assert(css.includes(selector),'missing '+selector)
  }
  assert(css.includes('color:var(--detail-ink)'))
  assert(css.includes('color:var(--detail-muted)'))
  assert(css.includes('color:#9ceac8'))
  assert(css.includes('color:#f4d08a'))
  assert(css.includes('color:#ffbccd'))
  assert(!css.includes('fetch('))
  assert(!css.includes('supabase.'))
})

test('source link and drawer text colors meet WCAG 4.5:1',()=>{
  for(const [text,bg] of [
    ['#21314e','#ffffff'],['#5726bd','#eee7ff'],
    ['#f1f5ff','#26334e'],['#ffffff','#3a315d'],
    ['#18263f','#f7f8fd'],['#52647e','#f7f8fd'],
    ['#f0f4ff','#19263d'],['#b3c2dc','#19263d'],
    ['#086b4e','#e5f8ef'],['#9ceac8','#15392f'],
    ['#89520a','#fff3d8'],['#f4d08a','#40311c'],
  ]) assert(ratio(text,bg)>=4.5,`insufficient contrast: ${text} on ${bg}, ratio ${ratio(text,bg).toFixed(2)}`)
})

test('new drawer rules are imported last, without touching source URL validation',()=>{
  const app=read('src/App.jsx')
  const imports=[...app.matchAll(/^import ['"]([^'"]+\.css)['"]$/gm)].map(m=>m[1])
  assert.equal(imports.at(-1),'./opportunity-detail-theme-pr84.css')
  assert.equal(imports.at(-2),'./ui-quickcapture-review-pr83.css')
})
