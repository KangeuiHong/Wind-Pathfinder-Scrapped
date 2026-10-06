/* Derived comparison only. The raw Matrix and original A/B stay untouched. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('../comparison/core.js'):root.WindComparisonCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.WindVectorCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
'use strict';
const SPEED_EPSILON=1e-12, EPSILON=1e-10, STEP_DURATION=5, STEP_LANE_THRESHOLD=2, STEP_SPEED_THRESHOLD=1, STEP_LANE_TOLERANCE=1, STEP_SPEED_TOLERANCE=.5;
const wrap=a=>(a%360+360)%360;
const circularDistance=(a,b)=>Math.min(Math.abs(a-b)%16,16-Math.abs(a-b)%16);
function vectorPair(speed,from){if(!Number.isFinite(speed)||speed<0)return null;if(speed===0)return {u:0,v:0};if(!Number.isFinite(from)||from<0||from>360)return null;const a=(from+180)*Math.PI/180;return {u:speed*Math.sin(a),v:speed*Math.cos(a)};}
function aggregate(entry,widthMinutes){
 if(![5,10].includes(widthMinutes))throw Error('Fixed clock bins must be 5 or 10 minutes.');
 const slots=[];
 for(let start=0;start<1440;start+=widthMinutes){const raw=entry.slots.slice(start,start+widthMinutes),valid=raw.filter(s=>s.status==='valid'||s.status==='calm');let u=0,v=0,total=0;
 for(const s of valid){const p=vectorPair(s.record.speedMps,s.record.directionFromDeg);if(!p)throw Error('A numerically valid source slot has no valid vector.');u+=p.u;v+=p.v;total+=s.record.speedMps;}
 const n=valid.length,calmCount=valid.filter(s=>s.status==='calm').length,missingCount=raw.filter(s=>s.status==='missing').length,unavailableCount=raw.filter(s=>s.status==='unavailable').length;
 if(n){u/=n;v/=n;}const magnitude=n?Math.hypot(u,v):null,scalarMeanSpeed=n?total/n:null;
 let status=n===0?(missingCount?'missing':'unavailable'):calmCount===n?'calm':magnitude<=EPSILON?'cancellation':'valid';
 const to=status==='valid'?wrap(Math.atan2(u,v)*180/Math.PI):null;
 slots.push({minute:start,start,end:start+widthMinutes,expected:widthMinutes,n,coverage:n/widthMinutes,partial:n>0&&n<widthMinutes,calmCount,missingCount,unavailableCount,u:n?u:null,v:n?v:null,scalarMeanSpeed,resultantRatio:scalarMeanSpeed>0?magnitude/scalarMeanSpeed:null,to,from:to===null?null:wrap(to+180),status,record:n?{speedMps:status==='calm'||status==='cancellation'?0:magnitude,directionFromDeg:to===null?null:wrap(to+180),derived:true}:null,derived:true});
 }
 return {station:entry.station,slots,widthMinutes,derived:true};
}
function connectable(a,b){return !!a&&!!b&&a.status==='valid'&&b.status==='valid'&&b.minute===a.end&&a.n===a.expected&&b.n===b.expected&&a.calmCount===0&&b.calmCount===0;}
function laneSegments(a,b,stepMode=false){if(!a||!b||a.status!=='valid'||b.status!=='valid')return [];const la=C.lane(a.to),lb=C.lane(b.to);const base={fromMinute:a.minute,toMinute:b.minute};if(Math.abs(lb-la)<=8)return [{...base,x1:a.minute,y1:la,x2:b.minute,y2:lb,wrap:false}];const adjusted=lb+(lb<la?16:-16),edge=adjusted>15?15.5:-.5,t=(edge-la)/(adjusted-la),x=stepMode?b.minute:a.minute+t*(b.minute-a.minute);return [{...base,x1:a.minute,y1:la,x2:x,y2:edge,wrap:true},{...base,x1:x,y1:edge===15.5?-.5:15.5,x2:b.minute,y2:lb,wrap:true}];}
function step(entry){let accepted=null,candidate=null;const slots=[],events=[];
 for(const raw of entry.slots){
  if(raw.status!=='valid'){slots.push({...raw,acceptedMinute:null,held:false,raw});accepted=null;candidate=null;continue;}
  const value={minute:raw.minute,to:raw.to,lane:C.lane(raw.to),speed:raw.record.speedMps};
  let acceptedNow=false;
  if(!accepted){accepted=value;acceptedNow=true;events.push({minute:raw.minute,reason:'segment-start',rawMinute:raw.minute});}
  else {const qualifies=circularDistance(value.lane,accepted.lane)>=STEP_LANE_THRESHOLD||Math.abs(value.speed-accepted.speed)+SPEED_EPSILON>=STEP_SPEED_THRESHOLD;
   if(!qualifies)candidate=null;
   else {const stable=candidate&&raw.minute===candidate.lastMinute+1&&circularDistance(value.lane,candidate.anchor.lane)<=STEP_LANE_TOLERANCE&&Math.abs(value.speed-candidate.anchor.speed)<=STEP_SPEED_TOLERANCE+SPEED_EPSILON;
    if(stable){candidate.count++;candidate.lastMinute=raw.minute;}else candidate={anchor:value,start:raw.minute,lastMinute:raw.minute,count:1};
    if(candidate.count>=STEP_DURATION){accepted=value;acceptedNow=true;events.push({minute:raw.minute,reason:'sustained-change',candidateStart:candidate.start,rawMinute:raw.minute});candidate=null;}
   }
  }
  slots.push({minute:raw.minute,status:'valid',to:accepted.to,record:{speedMps:accepted.speed,directionFromDeg:wrap(accepted.to+180),derived:true},acceptedMinute:accepted.minute,acceptedNow,held:accepted.minute!==raw.minute,pendingCount:candidate?.count||0,raw,derived:true});
 }
 return {station:entry.station,slots,events,derived:true,mode:'step'};
}
const statuses={valid:'방향 유효',calm:'관측 무풍',cancellation:'벡터상쇄/방향불안정',missing:'결측',unavailable:'미확보'};
const fixed=v=>Number.isFinite(v)?String(Number(v.toFixed(3))):'정의하지 않음';
function describeMean(s){return `[${C.clock(s.start)}, ${C.clock(s.end)}) KST · 구간평균 · ${s.n}/${s.expected}분${s.partial?' · 부분 구간':''} · ${statuses[s.status]} · FROM ${fixed(s.from)}${s.from===null?'':'°'} · TO ${fixed(s.to)}${s.to===null?'':'°'} · 벡터 크기 ${fixed(s.record?.speedMps)} m/s · 풍속 산술평균 ${fixed(s.scalarMeanSpeed)} m/s · 관측 무풍 ${s.calmCount} · 결측 ${s.missingCount} · 미확보 ${s.unavailableCount}`;}
function describeStep(s){return C.describe(s.raw||s)+(s.status==='valid'?` · 상태표시 TO ${fixed(s.to)}° / ${fixed(s.record.speedMps)} m/s · 채택 ${C.clock(s.acceptedMinute)}${s.held?' (이후 유지)':''}${s.pendingCount?` · 후보 지속 ${s.pendingCount}/5분`:''}`:' · 후보와 이전 상태를 초기화');}
return {EPSILON,STEP_DURATION,STEP_LANE_THRESHOLD,STEP_SPEED_THRESHOLD,STEP_LANE_TOLERANCE,STEP_SPEED_TOLERANCE,vectorPair,aggregate,step,circularDistance,connectable,laneSegments,describeMean,describeStep,statuses};
});
