/* Exact saved-sample clock. Emits every crossed frame with its scheduled time. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.SampleClock=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function create(count,onChange=()=>{}){
    if(!Number.isInteger(count)||count<1)throw new Error('저장 시각이 필요합니다.');
    let index=0,playing=false,rate=1,accumulator=0,last=null;
    function emit(event){onChange(index,event);}
    function pause(){playing=false;last=null;accumulator=0;}
    return{
      seek(next){if(!Number.isFinite(Number(next)))throw new Error('유효하지 않은 시각 위치');pause();index=Math.max(0,Math.min(count-1,Math.round(Number(next))));emit({reason:'seek'});},
      step(delta){this.seek(index+delta);},
      play(now=null){if(count<2)return;accumulator=0;last=Number.isFinite(now)?now:null;if(index===count-1){index=0;emit({reason:'restart'});}playing=true;},
      pause,
      setRate(value,now=null){const next=Number(value);if(![.5,1,2].includes(next))throw new Error('지원하지 않는 재생 속도');if(Number.isFinite(now)&&playing)this.tick(now);rate=next;last=Number.isFinite(now)?now:null;},
      rebase(now=null){accumulator=0;last=Number.isFinite(now)?now:null;},
      setCount(next){if(!Number.isInteger(next)||next<1)throw new Error('저장 시각이 필요합니다.');count=next;index=0;pause();},
      resetClock(){last=null;},
      tick(now){
        if(!playing){last=null;return false;}if(last===null){last=now;return false;}
        const start=last,dt=Math.max(0,now-last),prior=accumulator;last=now;accumulator+=dt*rate/1000;
        const steps=Math.floor(accumulator+1e-9);if(!steps)return false;accumulator=Math.max(0,accumulator-steps);
        const crossed=Math.min(steps,count-1-index);
        for(let n=1;n<=crossed;n++){index++;const scheduledAt=start+(n-prior)*1000/rate,isLast=index===count-1;if(isLast)pause();emit({reason:'tick',scheduledAt,now,ageSeconds:Math.max(0,(now-scheduledAt)/1000),isLast});}
        return true;
      },
      state(){return{index,playing,rate,count};}
    };
  }
  return{create};
});
