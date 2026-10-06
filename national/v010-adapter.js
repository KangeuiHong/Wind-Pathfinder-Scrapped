/* Original v0.10 drawing, wired to the current national page and coverage policy.
   The legacy renderer and its geometry modules are intentionally unchanged. */
(function(root){
  'use strict';
  const Original=root.StationParticleRenderer,G=root.ObservationsCore;
  function create(canvas,onFrame,directionCanvas){
    const legacy=Original.create(canvas,onFrame,directionCanvas);
    let rows=[],unit=null,displayIds=null,weatherTime=null;
    const shown=()=>displayIds?rows.filter(st=>displayIds.has(st.id)):rows;
    const refresh=()=>legacy.setData(shown(),unit);
    const flow=document.getElementById('flow-canvas');if(flow)flow.hidden=true;
    document.body.dataset.representation='baseline';document.body.dataset.windView='inspect';
    return {...legacy,
      setData(next,sharedUnit){rows=next;unit=sharedUnit;refresh();},
      setDisplayIds(ids){const next=ids?new Set(ids):null;
        if(next&&displayIds&&next.size===displayIds.size&&[...next].every(id=>displayIds.has(id)))return;
        displayIds=next;refresh();},
      setRepresentation(value){if(value!=='baseline')throw new Error('Only the original v0.10 expression is available');},
      setObservedTime(time){weatherTime=time;},
      startReplay(meta){weatherTime=meta.time;legacy.startReplay(meta);},
      emitFrame(meta,age){weatherTime=meta.time;legacy.emitFrame(meta,age);},
      state(){const s=legacy.state(),displayed=shown();return {...s,representation:'baseline',flow:{
        presentation:'inspect',canvasAvailable:s.canvasAvailable,weatherTime,
        renderedStations:s.visible&&s.canvasAvailable?displayed.filter(st=>{const p=legacy.inspect(st.id);return G.status(st)==='wind'&&p.visibleLength>0&&p.anchor.x>=s.view.x-40*s.scale&&p.anchor.x<=s.view.x+s.view.w+40*s.scale&&p.anchor.y>=s.view.y-40*s.scale&&p.anchor.y<=s.view.y+s.view.h+40*s.scale;}).length:0,
        displayedStationIds:displayed.map(st=>st.id),stationSuppression:displayed.length<rows.length,
        stationSelectionRule:displayIds?'fixed-geography-only; selected/hovered retained':'all',
        spatialInterpolation:false,temporalInterpolation:false,retainedHistory:false
      }};}
    };
  }
  root.StationParticleRenderer={create};
})(typeof window!=='undefined'?window:globalThis);
