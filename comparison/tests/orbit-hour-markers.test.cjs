'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {M,C,R,loadObserved,createApp}=require('./dom-harness.cjs');
const root=path.resolve(__dirname,'../..'),baseline=JSON.parse(fs.readFileSync(path.join(root,'verification/baseline.json'),'utf8'));
const model=M.prepareDataset(loadObserved()),j=model.stations.find(e=>e.station.id==='146');
const sha=v=>crypto.createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
const attrs=t=>Object.fromEntries([...t.matchAll(/([\w-]+)="([^"]*)"/g)].map(m=>[m[1],m[2]]));
const circles=svg=>[...svg.matchAll(/<circle\b[^>]*data-minute[^>]*>/g)].map(m=>attrs(m[0]));
const lines=svg=>[...svg.matchAll(/<line\b[^>]*data-from-minute[^>]*\/>/g)].map(m=>m[0]);
test('retained data and all numerical/render modules match the declared consolidation SHA-256 boundary',()=>{
 const exclusions=JSON.parse(fs.readFileSync(path.join(root,'verification/public-release-exclusions.json')));
 assert.equal(exclusions.schema,'wind-public-release-exclusions/1');
 assert.equal(exclusions.excludedFiles.length,1);
 const excluded=exclusions.excludedFiles[0];
 assert.equal(excluded.path,'matrix/data/source/raw/jeonju-20241006-wind-only-public-preview.html');
 assert.equal(excluded.sha256,baseline.fileHashes[excluded.path]);
 assert.equal(excluded.runtimeRequired,false);
 assert.equal(fs.existsSync(path.join(root,excluded.path)),false,'Excluded portal capture must not be published');
 for(const [file,expected]of Object.entries(baseline.fileHashes)){if(file===excluded.path)continue;assert.equal(sha(fs.readFileSync(path.join(root,file))),expected,file);}
});
test('all stations preserve exact raw geometry and both raw SVG renderings',()=>{
 for(const expected of baseline.stations){const e=model.stations.find(e=>e.station.id===expected.id);
 assert.equal(sha(C.build(e)),expected.geometry_sha256,`geometry ${expected.id}`);
 assert.equal(sha(R.path(e)),expected.raw_a_svg_sha256,`A ${expected.id}`);
 assert.equal(sha(R.polar(e)),expected.raw_b_svg_sha256,`B ${expected.id}`);
 }
});
test('Jeonju has 1,439 invisible minute targets and only 23 visible hour markers',()=>{
 const c=circles(R.polar(j)),hit=c.filter(a=>a.class.includes('minute-hit-area')),hours=c.filter(a=>a.class==='hour-point');
 assert.equal(hit.length,1439);assert.equal(hours.length,23);
 for(const a of hit){assert.equal(a['fill-opacity'],'0');assert.equal(a.stroke,'none');assert.equal(a['pointer-events'],'all');}
 assert.ok(c.every(a=>a['fill-opacity']==='0'||a.class==='hour-point'));
 assert.deepEqual(hours.map(a=>+a['data-minute']),Array.from({length:23},(_,i)=>(i+1)*60));
});
test('labels contain only acquired three-hour two-digit hours; no fabricated 00 or 24',()=>{
 const labels=[...R.polar(j).matchAll(/<text[^>]*class="hour-label"[^>]*>([^<]*)<\/text>/g)].map(m=>m[1]);
 assert.deepEqual(labels,['03','06','09','12','15','18','21']);
 assert.ok(!R.polar(j).includes('data-minute="0"'));assert.ok(!R.polar(j).includes('data-minute="1440"'));
});
test('only 06, 12, 18 get modest major-hour emphasis with existing acquired data',()=>{
 const h=circles(R.polar(j)).filter(a=>a.class==='hour-point');
 assert.deepEqual(h.filter(a=>a['data-major-hour']==='true').map(a=>+a['data-minute']),[360,720,1080]);
 for(const a of h){const major=+a['data-minute']%360===0;assert.equal(+a.r,major?4.9:4.1);assert.equal(+a['stroke-width'],major?1.6:1.3);assert.equal(a.fill,+a['data-minute']===420?'#ffffff':C.timeColor(+a['data-minute']));}
});
test('00 marker and 00 label appear only if a real midnight observation exists',()=>{
 const slots=j.slots.slice();slots[0]={...slots[1],minute:0};const synthetic={...j,slots},svg=R.polar(synthetic);
 const midnight=circles(svg).find(a=>a.class==='hour-point'&&a['data-minute']==='0');assert.ok(midnight);assert.equal(midnight['data-major-hour'],'true');assert.equal(midnight.r,'4.9');
 assert.match(svg,/<text[^>]*class="hour-label"[^>]*data-hour="0"[^>]*>00<\/text>/);
 assert.equal(j.slots[0].status,'unavailable');
});
test('07 calm stays at center and keeps its exact raw title with undefined TO',()=>{
 const svg=R.polar(j),h=circles(svg).find(a=>a.class==='hour-point'&&a['data-minute']==='420');
 assert.equal(h.cx,'295');assert.equal(h.cy,'262');assert.equal(h.fill,'#ffffff');
 assert.match(svg,/<circle class="hour-point" data-minute="420"[^>]*><title>07:00 KST · 무풍 .*TO 정의하지 않음/);
 assert.ok(!lines(svg).some(s=>/data-(?:from|to)-minute="420"/.test(s)));
});
test('hour markers are painted after all transparent minute targets; labels cannot intercept pointer hits',()=>{
 const svg=R.polar(j);assert.ok(svg.lastIndexOf('class="plot-point minute-hit-area"')<svg.indexOf('class="hour-point"'));
 for(const m of svg.matchAll(/<text[^>]*class="hour-label"[^>]*>/g))assert.match(m[0],/pointer-events="none"/);
 for(const m of svg.matchAll(/<line[^>]*>/g))if(!m[0].includes('data-from-minute')&&m[0].includes('stroke-width=".8"'))assert.match(m[0],/pointer-events="none"/);
});
test('invisible minute target retains raw hover, click selection, and leave restoration in DOM model',()=>{
 const h=createApp('#station=146'),chart=h.nodes['polar-chart'];h.app.selectMinute(10);
 const p=chart.querySelector('[data-minute="736"]');assert.equal(p.getAttribute('fill-opacity'),'0');
 chart.emit('mousemove',{target:p});assert.equal(h.nodes['detail-time'].textContent,'12:16 KST');assert.equal(h.nodes['detail-from'].textContent,'330.5°');assert.equal(h.nodes['detail-to'].textContent,'150.5°');assert.equal(h.nodes['detail-speed'].textContent,'2.7');assert.equal(h.app.getState().minute,10);
 chart.emit('mouseleave');assert.equal(h.nodes['detail-time'].textContent,'00:10 KST');
 chart.emit('click',{target:p});assert.equal(h.app.getState().minute,736);
});
test('hour-marker hover at calm center remains available and restores selected minute in DOM model',()=>{
 const h=createApp('#station=146'),chart=h.nodes['polar-chart'];h.app.selectMinute(100);
 const p=chart.querySelectorAll('.hour-point').find(a=>a.getAttribute('data-minute')==='420');
 chart.emit('mousemove',{target:p});assert.equal(h.nodes['detail-time'].textContent,'07:00 KST');assert.equal(h.nodes['detail-status'].textContent,'무풍');assert.equal(h.nodes['detail-to'].textContent,'정의하지 않음');
 chart.emit('click',{target:p});assert.equal(h.app.getState().minute,420);chart.emit('mouseleave');assert.equal(h.nodes['detail-time'].textContent,'07:00 KST');
});
