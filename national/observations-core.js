/* Measured station data and local glyph geometry. No spatial or temporal interpolation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ObservationsCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function buildSnapshot(source,period=1){
    if(![1,10].includes(period))throw new Error('평균기간은 1분 또는 10분이어야 합니다.');
    const rows=source.records.filter(r=>['SS','SA'].includes(r.source_network_code));
    const time=Date.parse(source.provenance.observation_time),seen=new Set();
    const stations=rows.map(r=>{
      if(Date.parse(r.timestamp_kst)!==time)throw new Error('관측시각이 서로 다른 자료는 함께 표시하지 않습니다.');
      const id=String(r.station_id);if(seen.has(id))throw new Error('중복 지점 ID');seen.add(id);
      return{id,name:r.name_ko,lat:r.latitude,lon:r.longitude,speed:r[`wind_speed_${period}min_ms`],from:r[`wind_direction_${period}min_deg`],temperature:null,network:r.source_network_code==='SS'?'ASOS':'AWS',period,time,qc:r.qc_flag,sensorHeight:r.sensor_height_m,elevation:r.station_elevation_m,original:r};
    });
    return{stations,time,period,source:'kma',provenance:source.provenance};
  }
  function status(station){return station.speed===null?'missing':station.speed===0?'calm':station.from===null?'direction-missing':'wind';}
  function formatNumber(value){return value===null||value===undefined?'결측':String(value);}
  function validDirection(from){return Number.isFinite(from)&&from>=0&&from<=360;}
  function formatFromDirection(from){return validDirection(from)?String(from)+'°':'결측';}
  function formatToDirection(from){
    if(!validDirection(from))return'결측';
    // Display-only decimal shift: adding 180 never changes the source fraction.
    // This avoids manufacturing binary subtraction tails without rounding the data.
    let decimal=String(from);
    if(decimal.includes('e')){
      const [coefficient,exponent]=decimal.split('e'),digits=coefficient.replace('.',''),point=(coefficient.includes('.')?coefficient.indexOf('.'):coefficient.length)+Number(exponent);
      decimal=point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point);
    }
    const fraction=(decimal.split('.')[1]||'').replace(/0+$/,'');
    return String((Math.floor(from)+180)%360)+(fraction?'.'+fraction:'')+'°';
  }
  function visualUnit(stations){const maximum=Math.max(1,...stations.map(s=>s.speed||0));return Math.min(2,24/maximum);}
  // Unit and scale are global. Density changes glyph count only, never measurements.
  function particleGeometry(speed,cycle,index=0,density=2,scale=1,unit=3){
    const length=Math.max(0,speed)*unit*scale,velocity=Math.max(0,speed)*unit*scale*.45;
    const travel=Math.min(10*scale,velocity*2.4),lifetime=velocity>0?travel/velocity:2.4;
    const progress=((cycle+index/density+.17)%1+1)%1;
    const center=(progress-.5)*travel,lane=(index-(density-1)/2)*2.3*scale;
    return{start:center-length/2,end:center+length/2,y:lane,length,travel,lifetime,velocity,progress,opacity:Math.pow(Math.sin(Math.PI*progress),.8)};
  }
  function smoothstep(t){const x=Math.max(0,Math.min(1,t));return x*x*(3-2*x);}
  // Animation is a directional cue within a fixed speed-proportional envelope.
  // Its changing visible length is NOT a changing wind-speed measurement.
  function pulseAtProgress(speed,progress,index=0,density=2,scale=1,unit=3,stopped=false){
    const length=Math.max(0,speed)*unit*scale,p=Math.max(0,Math.min(1,progress));
    const stage=stopped?'full':p<.45?'grow':p<.65?'hold':'erase';
    const revealed=stopped?1:stage==='grow'?smoothstep(p/.45):stage==='hold'?1:1-smoothstep((p-.65)/.35);
    const start=0,end=revealed*length,y=(index-(density-1)/2)*2.3*scale;
    return{start,end,y,length,maxLength:length,envelopeStart:0,envelopeEnd:length,visibleLength:end,lifetime:2.4,progress:p,headProgress:revealed,tailProgress:0,opacity:1,stage,mode:stopped?'full':'pulse'};
  }
  function pulseGeometry(speed,cycle,index=0,density=2,scale=1,unit=3,stopped=false){
    const progress=((cycle+index/density+.17)%1+1)%1;
    return pulseAtProgress(speed,progress,index,density,scale,unit,stopped);
  }
  // Fixed station-origin partitions: each full cell is exactly 1 m/s.
  // The final cell keeps its fractional length; no rounding of the measurement.
  function speedCells(speed,scale=1,unit=3){
    if(speed===null||!Number.isFinite(speed)||speed<=0)return[];
    if(speed>100)throw new RangeError('셀 표현은 지원 풍속 범위 0–100 m/s에 한합니다.');
    const step=unit*scale;
    return Array.from({length:Math.ceil(speed)},(_,index)=>({index,start:index*step,end:Math.min(index+1,speed)*step,fraction:Math.min(1,speed-index),tone:index%2===0?'light':'dark'}));
  }
  function clipCells(cells,start,end){return cells.map(cell=>({...cell,start:Math.max(cell.start,start),end:Math.min(cell.end,end)})).filter(cell=>cell.end>cell.start);}
  // Opaque dividers sit immediately inside the preceding cell; no gaps or added extent.
  function cellDividers(q,cellUnit,screenScale=1){
    if(!(cellUnit>0&&screenScale>0))return[];
    const width=Math.min(.65/screenScale,cellUnit*.18),dividers=[];
    for(let i=1;i<Math.ceil(q.speed);i++){const boundary=q.barLeft+i*cellUnit,start=Math.max(q.trackLeft,boundary-width),end=Math.min(q.trackRight,boundary);if(end>start)dividers.push({index:i,boundary,start,end});}
    return dividers;
  }
  function cellVisibility(unit,scale,displayScale,moving=true){const pixelWidth=unit*scale*displayScale,minimum=moving?4:2;return{pixelWidth,minimum,readable:pixelWidth>=minimum};}
  function rotateLocal(start,end,y,from){const angle=(from+90)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);return{x1:start*c-y*s,y1:start*s+y*c,x2:end*c-y*s,y2:end*s+y*c};}
  const HEAD=Object.freeze({lengthPx:4,halfWidthPx:2.6,strokePx:1.3});
  // A directional annotation independent of the cells or physical particle extent.
  // Default visible-edge attachment keeps TO readable while the body is visible.
  // Physical-head-only is retained solely as a review comparison.
  function directionHead(q,station,screenScale=1,anchor='visible'){
    const valid=Number.isFinite(station.speed)&&station.speed>0&&validDirection(station.from),physicalVisible=q.barRight>=q.trackLeft-1e-9&&q.barRight<=q.trackRight+1e-9,visible=valid&&q.visibleLength>1e-9&&(anchor==='visible'||physicalVisible);
    return{...HEAD,visible,anchor,physicalVisible,x:anchor==='visible'?q.end:q.barRight,y:q.y,length:HEAD.lengthPx/screenScale,halfWidth:HEAD.halfWidthPx/screenScale};
  }
  function summarize(stations){const counts={total:stations.length,valid:0,missing:0,calm:0,wind:0};for(const st of stations){const s=status(st);if(s==='calm'){counts.calm++;counts.valid++;}else if(s==='wind'){counts.wind++;counts.valid++;}else counts.missing++;}return counts;}
  return{buildSnapshot,status,formatNumber,formatFromDirection,formatToDirection,visualUnit,particleGeometry,pulseAtProgress,pulseGeometry,smoothstep,speedCells,clipCells,cellDividers,cellVisibility,rotateLocal,HEAD,directionHead,summarize};
});
