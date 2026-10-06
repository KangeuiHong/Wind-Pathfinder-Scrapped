(function(){'use strict';
const C=window.WindComparisonCore,V=window.WindVectorCore,VR=window.WindVectorRender,S=window.WindStationComparison,$=id=>document.getElementById(id);
let raw,five,ten,steps;
function detail(i){if(!raw)return;$('details').innerHTML=[['5분 벡터평균',V.describeMean(five.slots[Math.floor(i/5)])],['10분 벡터평균',V.describeMean(ten.slots[Math.floor(i/10)])],['5분 지속 상태',V.describeStep(steps.slots[i])]].map(([label,value])=>`<p><strong>${label}</strong> · ${VR.esc(value)}</p>`).join('');}
function render(station){raw=station;five=V.aggregate(raw,5);ten=V.aggregate(raw,10);steps=V.step(raw);
$('polar-five').innerHTML=VR.polar(five);$('polar-ten').innerHTML=VR.polar(ten);$('path-five').innerHTML=VR.path(five);$('path-step').innerHTML=VR.path(steps,'step');
const info=d=>`${d.widthMinutes}분 ${d.slots.length}구간(방향 ${d.slots.filter(s=>s.status==='valid').length} · 모두 관측 무풍 ${d.slots.filter(s=>s.status==='calm').length} · 부분 확보 ${d.slots.filter(s=>s.partial).length})`;
$('summary').textContent=`${raw.station.name} · ${info(five)}, ${info(ten)}. 지속 상태변화 ${steps.events.filter(e=>e.reason==='sustained-change').length}회와 유효 구간 시작 ${steps.events.filter(e=>e.reason==='segment-start').length}회입니다.`;detail(S.getState().minute);}
for(const id of ['polar-five','polar-ten','path-five','path-step']){const el=$(id);el.tabIndex=0;el.addEventListener('mousemove',e=>{const p=e.target.closest('[data-bin]');if(p)S.inspectMinute(Number(p.getAttribute('data-bin')));});el.addEventListener('click',e=>{const p=e.target.closest('[data-bin]');if(p)S.selectMinute(Number(p.getAttribute('data-bin')));});el.addEventListener('mouseleave',()=>S.inspectMinute(S.getState().minute));el.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const m=S.getState().minute;S.selectMinute(Math.max(0,Math.min(1439,e.key==='Home'?0:e.key==='End'?1439:m+(e.key==='ArrowLeft'?-1:1))));}});}
S.onStationChange(render);S.onMinuteChange(detail);
window.WindVectorComparison={get raw(){return raw},get five(){return five},get ten(){return ten},get steps(){return steps},selectMinute:S.selectMinute,getMinute:()=>S.getState().minute};
})();
