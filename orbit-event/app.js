(function(){'use strict';
const M=window.WindMatrixCore,E=window.WindOrbitEventCore,R=window.WindOrbitEventRender,$=id=>document.getElementById(id);
const S=window.WindStationComparison,plot=$('event-plot');let raw=S.getActiveStation(),result=null,selectedMinute=1,lastWidth=0;
function detail(p){$('event-details').textContent=p?R.describe(p):'표시할 실제 관측점이 없습니다';}
function selected(){return result?.displayed.find(p=>p.slot.minute===selectedMinute)||result?.first;}
function choose(p,sync=true){if(p){if(sync)S.selectMinute(p.slot.minute);selectedMinute=p.slot.minute;detail(p);$('point-index').textContent=`${result.displayed.indexOf(p)+1} / ${result.displayed.length}`;}}
function render(){const measured=plot.getBoundingClientRect().width;if(!(measured>0))return;const width=measured;if(result&&Math.abs(width-lastWidth)<.1)return;lastWidth=width;result=E.sample(raw,{viewportWidth:width});plot.innerHTML=R.polar(raw,result);$('event-summary').textContent=R.summary(result);$('viewport-detail').textContent=`기준 0→1 m/s 반지름 = ${result.thresholdPx.toFixed(2)} CSS px · 현재 그림 폭 ${width.toFixed(1)} CSS px · 크기가 바뀌어도 같은 원자료 점을 선택합니다`;
 const nearest=result.displayed.reduce((best,p)=>!best||Math.abs(p.slot.minute-selectedMinute)<Math.abs(best.slot.minute-selectedMinute)?p:best,null);if(nearest)choose(nearest,false);else{detail(null);$('point-index').textContent='0 / 0';}}
function shift(delta){if(!result?.displayed.length)return;const i=result.displayed.indexOf(selected());choose(result.displayed[Math.max(0,Math.min(result.displayed.length-1,i+delta))]);}
plot.addEventListener('mousemove',e=>{const p=e.target.closest('[data-bin]');if(p)detail(result.displayed.find(q=>q.slot.minute===Number(p.getAttribute('data-bin'))));});
plot.addEventListener('click',e=>{const p=e.target.closest('[data-bin]');if(p)choose(result.displayed.find(q=>q.slot.minute===Number(p.getAttribute('data-bin'))));});plot.addEventListener('mouseleave',()=>detail(selected()));
plot.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();if(!result)return;if(e.key==='Home')choose(result.first);else if(e.key==='End')choose(result.end);else shift(e.key==='ArrowLeft'?-1:1);}});
$('event-prev').addEventListener('click',()=>shift(-1));$('event-next').addEventListener('click',()=>shift(1));
S.onStationChange(station=>{raw=station;result=null;lastWidth=0;selectedMinute=S.getState().minute;render();});if(window.ResizeObserver){const observer=new window.ResizeObserver(render);observer.observe(plot);}else window.addEventListener('resize',render);
window.WindOrbitEvent={get raw(){return raw},render,getResult:()=>result,getSelectedMinute:()=>selectedMinute};
})();
