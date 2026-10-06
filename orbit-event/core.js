/* Display-only event sampling of the unchanged one-minute RAW observations. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WindOrbitEventCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const WIDTH=590,HEIGHT=550,CX=295,CY=262,RADIUS=198,SPEED_MAX=4,THRESHOLD_MPS=1;
// Saturated, continuous sRGB interpolation; these are color stops, never time bins.
const COLOR_STOPS=[[0,[48,18,175]],[.16,[0,83,235]],[.32,[0,151,170]],[.5,[40,140,0]],[.66,[215,151,0]],[.83,[245,66,0]],[1,[170,0,60]]];
function timeColor(minute){const t=Math.max(0,Math.min(1,minute/1439));let i=0;while(i<COLOR_STOPS.length-2&&t>COLOR_STOPS[i+1][0])i++;const [a,ca]=COLOR_STOPS[i],[b,cb]=COLOR_STOPS[i+1],f=(t-a)/(b-a);return `rgb(${ca.map((c,j)=>Number((c+(cb[j]-c)*f).toFixed(3))).join(',')})`;}
function project(slot){
 if(!slot||!Number.isFinite(slot.record?.speedMps))return null;
 // Observed zero speed is a real vector state. Its FROM source value is retained;
 // TO is undefined, so do not invent a bearing merely to place the center point.
 if(slot.status==='calm'&&slot.record.speedMps===0)return {x:CX,y:CY};
 if(slot.status!=='valid'||!Number.isFinite(slot.to)||!(slot.record.speedMps>0))return null;
 const angle=slot.to*Math.PI/180,k=RADIUS/SPEED_MAX;
 return {x:CX+Math.sin(angle)*slot.record.speedMps*k,y:CY-Math.cos(angle)*slot.record.speedMps*k};
}
function sample(entry,options={}){
 if(!entry||!Array.isArray(entry.slots)||(entry.widthMinutes!==undefined&&entry.widthMinutes!==1)||entry.slots.some(s=>s.start!==undefined||s.end!==undefined))throw Error('Event sampling requires one-minute RAW observations, not aggregated means.');
 if(options.thresholdPx!==undefined)throw Error('The threshold is the current 0-to-1 m/s radial distance, not a fixed pixel value.');
 const viewportWidth=options.viewportWidth??WIDTH,viewportHeight=options.viewportHeight??viewportWidth*HEIGHT/WIDTH;
 if(![viewportWidth,viewportHeight].every(n=>Number.isFinite(n)&&n>0))throw Error('CSS viewport dimensions must be positive finite numbers.');
 // SVG uses a uniform meet scale; both distances and the radial ruler scale together.
 const scale=Math.min(viewportWidth/WIDTH,viewportHeight/HEIGHT),thresholdPx=RADIUS/SPEED_MAX*THRESHOLD_MPS*scale;
 const displayed=[],edges=[];let run=-1,last=null,previous=null,final=null,inputCount=0,calmCount=0;
 for(const slot of entry.slots){
  const p=project(slot);if(!p){previous=null;last=null;continue;}inputCount++;if(slot.status==='calm')calmCount++;
  const newRun=!previous||slot.minute!==previous.minute+1;if(newRun){run++;last=null;}
  const distancePx=last?Math.hypot(p.x-last.x,p.y-last.y)*scale:null;
  const candidate={slot,x:p.x,y:p.y,run,distancePx,reason:last?'distance':displayed.length?'gap-restart':'first-observation'};final=candidate;
  // Tiny relative tolerance handles round-off at exact equality on responsive scales.
  if(!last||distancePx+thresholdPx*1e-12>=thresholdPx){if(last)edges.push({from:last,to:candidate});displayed.push(candidate);last=candidate;}
  previous=slot;
 }
 // Preserve the final actual observation, even if its position repeats the prior point.
 if(final&&displayed.at(-1).slot!==final.slot){final.reason='final-endpoint';const prior=displayed.at(-1);if(prior.run===final.run)edges.push({from:prior,to:final});displayed.push(final);}
 const first=displayed[0]||null,end=displayed.at(-1)||null;
 return {displayed,edges,first,end,thresholdPx,thresholdMps:THRESHOLD_MPS,viewportWidth,viewportHeight,scale,runCount:run+1,slotCount:entry.slots.length,inputCount,validCount:inputCount,calmCount,directionalCount:inputCount-calmCount,counts:displayed.reduce((a,p)=>(a[p.reason]=(a[p.reason]||0)+1,a),{})};
}
return {WIDTH,HEIGHT,CX,CY,RADIUS,SPEED_MAX,THRESHOLD_MPS,COLOR_STOPS,timeColor,project,sample};
});
