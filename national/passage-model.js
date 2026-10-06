/* Approved D motion: constant-length bar through a centered hidden window.
   Adapted directly from the user-approved standalone D study. Display units only. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PassageModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const duration=4;
  function phaseForStation(id){let h=2166136261;for(const c of String(id))h=Math.imul(h^c.charCodeAt(0),16777619)>>>0;h=Math.imul(h^(h>>>16),0x7feb352d);h=Math.imul(h^(h>>>15),0x846ca68b);return((h^(h>>>16))>>>0)/4294967296;}
  function passage(speed,phase,reading=false,unit=3,includeCells=true){
    const p=((phase%1)+1)%1,L=Math.max(0,speed||0)*unit,W=2*L,left=-W/2,right=W/2;
    const travelPhase=Math.min(p/.94,1);
    const x=reading?-L/2:left-L+travelPhase*(W+L);
    return{speed,phase:p,travelPhase,length:L,trackLength:W,trackLeft:left,trackRight:right,barLeft:x,barRight:x+L,visibleLeft:Math.max(left,x),visibleRight:Math.min(right,x+L),visibleLength:Math.max(0,Math.min(right,x+L)-Math.max(left,x)),cells:includeCells?Array.from({length:Math.ceil(Math.max(0,speed||0))},(_,i)=>({x:i*unit,width:Math.min(unit,L-i*unit),light:i%2===0})):[]};
  }
  function geometry(speed,phase,index=0,density=1,scale=1,unit=3,reading=false,includeCells=true){
    const m=passage(speed,phase+index/density,reading,unit*scale,includeCells),y=(index-(density-1)/2)*2.3*scale;
    const cells=m.cells.map((c,index)=>({index,start:c.x,end:c.x+c.width,fraction:c.width/(unit*scale),tone:c.light?'light':'dark'}));
    const clippedCells=cells.map(c=>({...c,start:Math.max(m.trackLeft,m.barLeft+c.start),end:Math.min(m.trackRight,m.barLeft+c.end)})).filter(c=>c.end>c.start);
    return{...m,start:m.visibleLeft,end:m.visibleRight,y,maxLength:m.length,progress:m.phase,lifetime:duration,mode:reading?'full':'passage',cells,clippedCells};
  }
  return{duration,phaseForStation,passage,geometry};
});
