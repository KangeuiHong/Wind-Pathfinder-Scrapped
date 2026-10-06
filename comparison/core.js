/* Display-only geometry. Source records remain unchanged in WindMatrixCore. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WindComparisonCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const LANES=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const MAX_SPEED=4;
const clock=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const lane=to=>Number.isFinite(to)?Math.floor(((to%360+360)%360+11.25)/22.5)%16:null;
const timeColor=m=>{const stops=[[41,99,189],[47,165,174],[229,174,70],[173,69,109]],f=Math.max(0,Math.min(1,m/1440))*3,i=Math.min(2,Math.floor(f)),t=f-i;return 'rgb('+stops[i].map((v,k)=>Math.round(v+(stops[i+1][k]-v)*t)).join(',')+')';};
const speedColor=s=>{const t=Math.max(0,Math.min(1,s/MAX_SPEED));return `rgb(${Math.round(115-90*t)},${Math.round(166-82*t)},${Math.round(187-70*t)})`;};
function pathSegments(a,b){
  if(!a||!b||a.status!=='valid'||b.status!=='valid'||b.minute!==a.minute+1)return [];
  const y1=lane(a.to), y2=lane(b.to), base={fromMinute:a.minute,toMinute:b.minute,speed:b.record.speedMps};
  if(Math.abs(y2-y1)<=8)return [{...base,x1:a.minute,y1,x2:b.minute,y2,wrap:false}];
  const adjusted=y2+(y2<y1?16:-16),edge=adjusted>15?15.5:-.5,t=(edge-y1)/(adjusted-y1),x=a.minute+t;
  return [{...base,x1:a.minute,y1,x2:x,y2:edge,wrap:true},{...base,x1:x,y1:edge===15.5?-.5:15.5,x2:b.minute,y2,wrap:true}];
}
function polarPoint(slot){if(slot.status==='calm')return {minute:slot.minute,x:0,y:0,radius:0,to:null,status:'calm'};if(slot.status!=='valid')return null;const a=slot.to*Math.PI/180;return {minute:slot.minute,x:Math.sin(a)*slot.record.speedMps,y:-Math.cos(a)*slot.record.speedMps,radius:slot.record.speedMps,to:slot.to,status:'valid'};}
function build(entry){
  const path=[],polar=[],segments=[],hourly=[],labels=[],stateRuns=[];
  for(const slot of entry.slots){
    if(slot.status==='valid')path.push({minute:slot.minute,lane:lane(slot.to),to:slot.to,speed:slot.record.speedMps});
    const p=polarPoint(slot);if(p){polar.push(p);if(slot.minute%60===0){hourly.push(p);if(slot.minute%180===0)labels.push(p);}}
    if(slot.minute>0){const prev=entry.slots[slot.minute-1];segments.push(...pathSegments(prev,slot));}
    const last=stateRuns.at(-1);if(last&&last.status===slot.status)last.end=slot.minute;else stateRuns.push({start:slot.minute,end:slot.minute,status:slot.status});
  }
  const polarSegments=[];for(let i=1;i<entry.slots.length;i++){const a=entry.slots[i-1],b=entry.slots[i];if(a.status==='valid'&&b.status==='valid')polarSegments.push({a:polarPoint(a),b:polarPoint(b)});}
  return {path,polar,segments,polarSegments,hourly,labels,stateRuns};
}
function rawFrom(slot){const r=slot.record;if(!r)return '—';const raw=r.rawValues||{};const value=raw['풍향(deg)']??raw.MI1_AVG_WD??raw.WD1??r.directionFromDeg;return value===null||value===undefined||value===''?'—':`${value}°`;}
const statusText={valid:'방향 관측',calm:'무풍',missing:'결측',unavailable:'미확보'};
function describe(slot){return `${clock(slot.minute)} KST · ${statusText[slot.status]} · FROM ${rawFrom(slot)} · TO ${slot.to===null?'정의하지 않음':String(Number(slot.to.toFixed(10)))+'°'} · ${slot.record?.speedMps===null||slot.record?.speedMps===undefined?'풍속 없음':slot.record.speedMps+' m/s'}`;}
return {LANES,MAX_SPEED,clock,lane,timeColor,speedColor,pathSegments,polarPoint,build,rawFrom,statusText,describe};
});
