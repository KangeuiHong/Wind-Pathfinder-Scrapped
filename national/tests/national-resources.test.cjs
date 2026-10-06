'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {ROOT,html,history}=require('./national-harness.cjs');
const baseline=require('./v0111-preserved-hashes.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

test('all 18 v0.11.1 preserved model, renderer, map and history bytes retain their source SHA-256',()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'national/preserved-source-hashes.json'),'utf8'));assert.deepEqual(manifest,baseline);assert.equal(Object.keys(baseline.files).length,18);for(const [file,hash]of Object.entries(baseline.files))assert.equal(sha(fs.readFileSync(path.join(ROOT,'national',file))),hash,file);
 // Critical corrected C source is independently pinned, not solely trusted via runtime manifest.
 assert.equal(baseline.files['particle-renderer.js'],'75bd5d887d033dad3a47d91a8537c20221259413d70062be4abd76fa039e46ff');assert.equal(baseline.files['flow-model.js'],'700b68cf9994fa1184bc78ced9ca9c1ab878b8cb37f9f8df989cbdeb7aa82867');
});

test('National JSON, offline JS and CSV are one exact 638-station, 61-frame source dataset',()=>{
 const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(ROOT,'national/history-data.js'),'utf8'),context);assert.deepEqual(JSON.parse(JSON.stringify(context.window.WIND_HISTORY)),history);assert.equal(history.stations.length,638);assert.equal(history.frames.length,61);assert.equal(history.frames[0].time,'2026-10-03T14:32:00+09:00');assert.equal(history.frames.at(-1).time,'2026-10-03T15:32:00+09:00');assert.equal(history.provenance.synthetic_weather,false);assert.equal(history.provenance.measured_observations,true);const roster=new Set(history.stations.map(s=>s.id));assert.equal(roster.size,638);for(let i=0;i<61;i++){assert.equal(Date.parse(history.frames[i].time)-Date.parse(history.frames[0].time),i*60000);for(const p of ['1','10']){const rows=history.frames[i].samples[p];assert.equal(rows.length,638);assert.equal(new Set(rows.map(s=>s.id)).size,638);assert.ok(rows.every(r=>roster.has(r.id)));}}
 const csv=fs.readFileSync(path.join(ROOT,'national/data/history-20261003.csv'),'utf8');assert.equal(csv.trimEnd().split(/\r?\n/).length,77837);
});

test('all live page scripts, stylesheets, local links and CSS imports/URLs exist without remote runtime dependencies',()=>{
 for(const file of ['index.html','VECTOR_COMPARE.html','NATIONAL_COMPARE.html']){const text=fs.readFileSync(path.join(ROOT,file),'utf8'),ids=[...text.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length,`${file}: unique IDs`);for(const [,raw]of text.matchAll(/(?:src|href)="([^"]+)"/g)){assert.ok(!/^https?:/i.test(raw),`${file}: remote runtime/nav ${raw}`);const ref=raw.split(/[?#]/)[0];if(ref)assert.ok(fs.existsSync(path.resolve(ROOT,ref)),`${file}: missing ${ref}`);}}
 const cssFiles=[...html.matchAll(/<link\b[^>]*href="([^"]+\.css)"/g)].map(m=>m[1]);assert.deepEqual(cssFiles,['national/styles.css','national/clean.css']);for(const f of cssFiles){const css=fs.readFileSync(path.join(ROOT,f),'utf8');for(const [,raw]of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)){if(raw.startsWith('#')||raw.startsWith('data:'))continue;assert.ok(!/^https?:/i.test(raw),`${f}: remote CSS ${raw}`);assert.ok(fs.existsSync(path.resolve(ROOT,path.dirname(f),raw.split(/[?#]/)[0])),`${f}: missing ${raw}`);}}
});

test('only history-backed wind controls are present and live navigation names all three canonical views',()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);for(const id of ids)assert.ok(!/^candidate-|^temperature-(?:toggle|legend)|^dataset-select$|^file-input$|^density$|^replay-style$/.test(id),`unexpected control ${id}`);const scripts=[...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(scripts).size,scripts.length);assert.ok(!scripts.some(s=>/temperature|observations-data/.test(s)));const nav=/<nav\b[^>]*>([\s\S]*?)<\/nav>/.exec(html)[1];for(const dest of ['index.html','VECTOR_COMPARE.html','NATIONAL_COMPARE.html'])assert.ok(nav.includes(`href="${dest}"`));assert.match(nav,/Map View/);assert.match(nav,/Station View/);assert.match(nav,/지역별 바람 비교/);assert.match(html,/전체 막대 길이는 풍속에 비례/);assert.match(html,/실제 공기.*경로/);assert.match(html,/QC 정보는 미제공/);
});
