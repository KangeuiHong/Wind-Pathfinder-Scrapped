'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {ROOT, M, C, R, loadObserved, createApp} = require('./dom-harness.cjs');
const source = loadObserved(), model = M.prepareDataset(source), entry = id => model.stations.find(e=>e.station.id===id);
const near = (a,b,epsilon=1e-8) => assert.ok(Math.abs(a-b)<epsilon, `${a} != ${b}`);
const rawMinutes = svg => [...svg.matchAll(/class="hour-point" data-minute="(\d+)"/g)].map(m=>Number(m[1]));

test('source remains unchanged after geometry and SVG rendering', () => {
 const before=JSON.stringify(source); for(const e of model.stations) { C.build(e); R.path(e); R.polar(e); } assert.equal(JSON.stringify(source),before);
});
test('observed Jeonju has 1440 slots, 1361 direction points, 78 calm center points, one unacquired minute', () => {
 const e=entry('146'), d=C.build(e); assert.equal(e.slots.length,1440); assert.equal(d.path.length,1361); assert.equal(d.polar.length,1439); assert.equal(d.polar.filter(p=>p.status==='calm').length,78); assert.equal(e.slots[0].status,'unavailable');
 for(const p of d.polar.filter(p=>p.status==='calm')) { assert.equal(p.x,0); assert.equal(p.y,0); assert.equal(p.to,null); }
});
test('all plotted values use their original exact angle and speed', () => {
 for(const e of model.stations) for(const p of C.build(e).polar) { const s=e.slots[p.minute]; near(p.radius,s.record.speedMps); if(p.status==='valid') {near(Math.hypot(p.x,p.y),s.record.speedMps); near(p.to,(s.record.directionFromDeg+180)%360);} }
 const s=entry('146').slots[10]; assert.equal(C.rawFrom(s),'108.1°'); near(s.to,288.1); assert.match(C.describe(s),/TO 288\.1°/);
});
test('hour points equal actual acquired exact-hour observations, never 00:00 or 24:00', () => {
 for(const e of model.stations) {const expected=e.slots.filter(s=>s.minute%60===0 && ['valid','calm'].includes(s.status)).map(s=>s.minute); const d=C.build(e); assert.deepEqual(d.hourly.map(p=>p.minute),expected); assert.deepEqual(rawMinutes(R.polar(e)),expected); assert.ok(!expected.includes(0)); assert.ok(!expected.includes(1440)); assert.deepEqual(d.labels.map(p=>p.minute),expected.filter(m=>m%180===0)); }
 assert.equal(C.build(entry('146')).hourly.length,23); assert.equal(C.build(entry('243')).hourly.length,22); assert.ok(!C.build(entry('243')).hourly.some(p=>p.minute===1380));
});
test('calm, missing and unacquired never create directional segments or fabricated points', () => {
 for(const e of model.stations) { const d=C.build(e); for(const seg of d.segments) {assert.equal(e.slots[seg.fromMinute].status,'valid'); assert.equal(e.slots[seg.toMinute].status,'valid'); assert.equal(seg.toMinute,seg.fromMinute+1);} for(const seg of d.polarSegments) {assert.equal(seg.b.minute,seg.a.minute+1); assert.equal(e.slots[seg.a.minute].status,'valid'); assert.equal(e.slots[seg.b.minute].status,'valid');} }
 const b=entry('243'); for(let i=1378;i<=1392;i++) {assert.equal(b.slots[i].status,'missing'); assert.equal(C.polarPoint(b.slots[i]),null);} const aws=model.stations.find(e=>e.counts.unavailable===1440); assert.deepEqual(C.build(aws).polar,[]); assert.deepEqual(C.build(aws).path,[]);
});
test('all 16×16 wrap combinations follow shortest lane route without full-height crossing', () => {
 const slot=(minute,lane)=>({minute,status:'valid',to:lane*22.5,record:{speedMps:1}});
 for(let a=0;a<16;a++) for(let b=0;b<16;b++) {const seg=C.pathSegments(slot(10,a),slot(11,b)); assert.equal(seg.length,Math.abs(b-a)>8?2:1); near(seg[0].x1,10); near(seg.at(-1).x2,11); for(const s of seg) {assert.ok(s.x2>=s.x1); assert.ok(Math.abs(s.y2-s.y1)<=8); assert.ok(s.y1>=-.5 && s.y1<=15.5); assert.ok(s.y2>=-.5 && s.y2<=15.5);} if(seg.length===2) {near(seg[0].x2,seg[1].x1); near(Math.abs(seg[0].y2-seg[1].y1),16);} }
 assert.deepEqual(C.pathSegments(slot(10,0),slot(12,15)),[]);
});
test('SVG directions, state rows and minute IDs cover all 1440 slots exactly once in A', () => {
 for(const e of model.stations) {const svg=R.path(e), ids=[...svg.matchAll(/class="(?:plot-point|state-point)" data-minute="(\d+)"/g)].map(m=>Number(m[1])); assert.equal(ids.length,1440); assert.equal(new Set(ids).size,1440); assert.equal(Math.min(...ids),0); assert.equal(Math.max(...ids),1439); assert.ok(!svg.includes('NaN')); assert.ok(!svg.includes('Infinity')); }
});

// These tests execute the real app.js against an explicit DOM/event/history model.
// They are not browser, accessibility-engine, visual, or native-input QA.
const h=createApp(), {app,nodes,window:win}=h;
function selectStation(id='146') {app.selectStation(id); h.flush();}
function assertMinute(minute) {assert.equal(app.getState().minute,minute); assert.equal(nodes['minute-input'].value,C.clock(minute)); assert.equal(nodes['detail-time'].textContent,C.clock(minute)+' KST'); const cells=h.cells(); assert.equal(cells.filter(c=>c.classList.contains('selected')).length,1); assert.ok(cells[minute].classList.contains('selected')); assert.equal(cells.filter(c=>c.tabIndex===0).length,1); assert.equal(cells[minute].getAttribute('aria-pressed'),'true');}
function changeTime(value) {nodes['minute-input'].value=value; nodes['minute-input'].emit('change');}

test('DOM model: canonical Station View is default and has all 43 station options', () => {
 assert.equal(app.getState().view,'station'); assert.equal(app.getState().stationId,'146'); assert.equal(nodes['station-view'].hidden,false); assert.equal(nodes['map-view'],undefined); assert.equal(nodes['station-tab'].getAttribute('aria-current'),'page'); assert.equal(nodes['station-select'].children.length,43); assertMinute(1);
});
test('DOM model: Map-only page markers, lists and keyboard route to canonical Station View', () => {
 const map=createApp('', 'index.html'), n=map.nodes;
 assert.equal(map.app.getState().view,'map'); assert.equal(n['map-stations'].children.length,43); assert.equal(n['map-station-list'].children.length,10); assert.equal(n['aws-list'].children.length,33); assert.equal(n['wind-matrix'],undefined);
 const marker=n['map-stations'].children.find(n=>n.getAttribute('aria-label').startsWith('군산 '));marker.click();assert.equal(map.window.location.href,'VECTOR_COMPARE.html#station=140');
 const jj=n['map-stations'].children.find(n=>n.getAttribute('aria-label').startsWith('전주 '));assert.equal(jj.emit('keydown',{key:'Enter'}).defaultPrevented,true);assert.equal(map.window.location.href,'VECTOR_COMPARE.html#station=146');
 selectStation('243');nodes['back-map'].click();assert.equal(win.location.href,'index.html#station=243');
});
test('DOM model: station dropdown updates counts/charts/raw grid and preserves shared selected minute', () => {
 app.selectMinute(100); nodes['station-select'].value='243'; nodes['station-select'].emit('change'); h.flush(); assert.equal(app.getState().stationId,'243'); assert.equal(nodes['missing-count'].textContent,'15'); assert.equal(nodes['usable-count'].textContent,'1,424'); assert.equal(nodes['calm-count'].textContent,'853'); assert.equal(h.cells().length,1440); assertMinute(100); selectStation(); assert.equal(nodes['usable-count'].textContent,'1,439'); assert.equal(nodes['calm-count'].textContent,'78'); assert.equal(nodes['unacquired-count'].textContent,'1'); assert.equal(nodes['path-chart'].querySelectorAll('.plot-point').length,1361); assert.equal(h.cells().filter(c=>c.classList.contains('valid')).length,1361);
});
test('DOM model: hash back/forward restores stations and invalid hash falls back to Jeonju', () => {
 const direct=createApp('#station=146');direct.app.selectStation('140');direct.flush();direct.app.selectStation('243');direct.flush();direct.window.history.back();direct.flush();assert.equal(direct.app.getState().stationId,'140');direct.window.history.back();direct.flush();assert.equal(direct.app.getState().stationId,'146');direct.window.history.forward();direct.flush();assert.equal(direct.app.getState().stationId,'140');direct.window.history.forward();direct.flush();assert.equal(direct.app.getState().stationId,'243');direct.window.location.hash='station=99999';direct.flush();assert.equal(direct.app.getState().view,'station');assert.equal(direct.app.getState().stationId,'146');
});
test('DOM model: direct station hash is honored on initial startup', () => {
 const direct=createApp('#station=243'); assert.equal(direct.app.getState().stationId,'243'); assert.equal(direct.app.getState().view,'station'); assert.equal(direct.nodes['missing-count'].textContent,'15');
});
test('DOM model: 24×60 raw grid, time input and previous/next are one shared selection', () => {
 selectStation(); const table=nodes['wind-matrix']; assert.equal(table.tHead.children[0].children.length,61); assert.equal(table.tBodies[0].children.length,24); for(const row of table.tBodies[0].children) assert.equal(row.children.length,61); assert.deepEqual(h.cells().map(c=>Number(c.dataset.minute)),Array.from({length:1440},(_,i)=>i)); changeTime('23:59'); assertMinute(1439); nodes['next-minute'].click(); assertMinute(1439); changeTime('00:00'); nodes['previous-minute'].click(); assertMinute(0); nodes['next-minute'].click(); assertMinute(1); for(const bad of ['24:00','23:60','','1:00','abc']) {changeTime(bad); assertMinute(1);} for(const bad of [-1,1440,1.5,NaN]) assert.equal(app.selectMinute(bad),false);
});
test('DOM model: grid arrow/Home/End keys and chart arrow controls update all selection state', () => {
 selectStation(); app.selectMinute(65); h.cells()[65].emit('keydown',{key:'ArrowUp'}); assertMinute(5); h.cells()[5].emit('keydown',{key:'ArrowDown'}); assertMinute(65); h.cells()[65].emit('keydown',{key:'Home'}); assertMinute(60); h.cells()[60].emit('keydown',{key:'End'}); assertMinute(119); h.cells()[119].emit('keydown',{key:'Home',ctrlKey:true}); assertMinute(0); h.cells()[0].emit('keydown',{key:'ArrowLeft'}); assertMinute(0); h.cells()[0].emit('keydown',{key:'End',ctrlKey:true}); assertMinute(1439); for(const id of ['path-chart','polar-chart']) {nodes[id].emit('keydown',{key:'Home'}); assertMinute(0); nodes[id].emit('keydown',{key:'ArrowRight'}); assertMinute(1); nodes[id].emit('keydown',{key:'ArrowDown'}); assertMinute(2); nodes[id].emit('keydown',{key:'ArrowUp'}); assertMinute(1); nodes[id].emit('keydown',{key:'End'}); assertMinute(1439);}
});
test('DOM model: raw-cell hover is temporary, click persists, leaving restores selected details', () => {
 selectStation(); app.selectMinute(10); const selectedOverlay=nodes['path-selection'].innerHTML; h.cells()[20].emit('mouseenter'); assert.equal(app.getState().minute,10); assert.equal(nodes['minute-input'].value,'00:10'); assert.equal(nodes['detail-time'].textContent,'00:20 KST'); assert.notEqual(nodes['path-selection'].innerHTML,selectedOverlay); h.cells()[20].emit('mouseleave'); assertMinute(10); assert.equal(nodes['path-selection'].innerHTML,selectedOverlay); h.cells()[20].click(); assertMinute(20); h.cells()[30].emit('mouseenter'); h.cells()[30].emit('mouseleave'); assertMinute(20);
});
test('DOM model: chart hover and clicks synchronize both chart overlays, raw details and matrix', () => {
 selectStation(); app.selectMinute(10); for(const id of ['path-chart','polar-chart']) {const chart=nodes[id], point=chart.querySelector('[data-minute="40"]'); assert.ok(point); chart.emit('mousemove',{target:point}); assert.equal(app.getState().minute,10); assert.equal(nodes['detail-time'].textContent,'00:40 KST'); chart.emit('mouseleave'); assertMinute(10); chart.emit('click',{target:point}); assertMinute(40); assert.ok(nodes['path-selection'].innerHTML); assert.ok(nodes['polar-selection'].innerHTML); app.selectMinute(10);}
});
test('DOM model: path background hit test works at natural aspect ratio for desktop/mobile sizes', () => {
 selectStation(); const chart=nodes['path-chart'], svg=chart.querySelector('svg'); for(const width of [850,1160,1374]) {svg.box={left:41,top:70,width,height:width*430/1160}; for(const minute of [0,1,720,1439]) {const clientX=41+(70+minute/1439*1062)*width/1160; chart.emit('click',{target:svg,clientX,clientY:100}); assertMinute(minute);}} const css=fs.readFileSync(path.join(ROOT,'comparison/styles.css'),'utf8'); assert.ok(!/\.path-chart\s+svg\s*\{[^}]*max-height\s*:/.test(css),'A max-height constraint causes letterboxing and invalidates current clientX mapping');
});
test('DOM model: stale hover is replaced by direct time selection, navigation, or station change', () => {
 selectStation(); app.selectMinute(10); h.cells()[20].emit('mouseenter'); changeTime('01:00'); assertMinute(60); h.cells()[20].emit('mouseenter'); nodes['next-minute'].click(); assertMinute(61); h.cells()[20].emit('mouseenter'); selectStation('140'); assertMinute(61); assert.equal(nodes['station-name'].textContent,'군산');
});
test('DOM model: calm raw FROM is retained, TO is undefined and B highlight is at center', () => {
 selectStation(); const calm=entry('146').slots.find(s=>s.status==='calm'); app.selectMinute(calm.minute); assert.equal(nodes['detail-status'].textContent,'무풍'); assert.equal(nodes['detail-speed'].textContent,'0'); assert.equal(nodes['detail-to'].textContent,'정의하지 않음'); assert.equal(nodes['detail-from'].textContent,C.rawFrom(calm)); assert.equal(h.cells()[calm.minute].textContent,'○'); assert.match(nodes['polar-selection'].innerHTML,/cx="295" cy="262"/); assert.equal(nodes['path-selection'].querySelectorAll('circle').length,0);
});
test('DOM model: Buan missing and AWS unacquired states never fabricate chart observations', () => {
 selectStation('243'); app.selectMinute(1380); assert.equal(nodes['detail-status'].textContent,'결측'); assert.equal(h.cells()[1380].textContent,'×'); assert.equal(nodes['detail-speed'].textContent,'—'); assert.equal(nodes['polar-selection'].innerHTML,''); assert.match(nodes['raw-values'].textContent,/"풍속\(m\/s\)":""/); const aws=model.stations.find(s=>s.counts.unavailable===1440); selectStation(aws.station.id); assert.equal(nodes['empty-notice'].hidden,false); assert.equal(nodes['unacquired-count'].textContent,'1,440'); assert.equal(h.cells().filter(c=>c.classList.contains('unavailable')).length,1440); assert.equal(nodes['polar-chart'].querySelectorAll('.plot-point').length,0); assert.equal(nodes['polar-chart'].querySelectorAll('.hour-point').length,0); assert.equal(nodes['path-chart'].querySelectorAll('.plot-point').length,0); assert.equal(nodes['detail-status'].textContent,'미확보'); assert.equal(nodes['raw-values'].textContent,'원본 행 없음'); selectStation(); assert.equal(nodes['empty-notice'].hidden,true); app.selectMinute(0); assert.equal(nodes['detail-status'].textContent,'미확보'); assert.equal(nodes['polar-selection'].innerHTML,'');
});
