/* Finite observation births. The bar stores its source sample until its own death. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./passage-model.js'):root.PassageModel);if(typeof module==='object'&&module.exports)module.exports=api;else root.CohortModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(M){
  'use strict';
  const EXPIRY_EPSILON=1e-9; // Seconds: absorb floating addition at an exact death boundary.
  function geometry(speed,age,scale=1,unit=3,includeCells=true,lifetime=M.duration){
    if(![2,4].includes(lifetime))throw new Error('지원하지 않는 막대 수명');
    const progress=Math.max(0,Math.min(1,age/lifetime));
    // Clamp at the fully hidden exit: this birth never wraps or respawns.
    const q=M.geometry(speed,Math.min(.94,progress),0,1,scale,unit,false,includeCells);
    return{...q,progress,phase:progress,age,alive:age>=0&&age<lifetime-EXPIRY_EPSILON,mode:'birth',lifetime};
  }
  function create(){
    let cohorts=[],seen=new Set(),serial=0;
    function prune(now){cohorts=cohorts.filter(c=>now-c.bornAt<c.lifetime-EXPIRY_EPSILON);}
    return{
      clear(){cohorts=[];seen.clear();},
      emit(rows,{key,time,period,unit,bornAt,now,lifetime=M.duration}){
        if(![2,4].includes(lifetime))throw new Error('지원하지 않는 막대 수명');
        if(seen.has(key))return false;seen.add(key);prune(now);
        if(now-bornAt>=lifetime-EXPIRY_EPSILON)return false;
        const snapshots=rows.filter(s=>s.speed>0&&Number.isFinite(s.speed)&&Number.isFinite(s.from)).map(s=>Object.freeze({...s}));
        // Empty frames are recorded as emitted but do not create visible symbols.
        if(!snapshots.length)return false;
        cohorts.push(Object.freeze({id:++serial,key,time,period,unit,bornAt,lifetime,stations:Object.freeze(snapshots)}));return true;
      },
      active(now){prune(now);return cohorts.slice();},
      state(now){prune(now);return cohorts.map(c=>({id:c.id,key:c.key,time:c.time,period:c.period,unit:c.unit,bornAt:c.bornAt,lifetime:c.lifetime,age:now-c.bornAt,count:c.stations.length}));},
      geometry
    };
  }
  return{duration:M.duration,geometry,create};
});
