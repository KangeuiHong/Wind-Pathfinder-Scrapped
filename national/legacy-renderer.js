/* Current observed-frame D loops (default), with opt-in historical-birth comparison. */
(function(root){
  'use strict';
  const G=root.ObservationsCore,C=root.WindCore,M=root.PassageModel,B=root.CohortModel;
  const PAINT={light:'#b8b8b8',dark:'#111111',tip:'#b72b2e',divider:'#f1f1ed',outline:'#111111',outlineInset:.4,normalWidth:2.4,selectedWidth:3};root.WindPaint=Object.freeze(PAINT);
  function create(canvas,onFrame,directionCanvas=null){
    const ctx=canvas.getContext('2d'),directionCtx=directionCanvas?.getContext?.('2d')||null,births=B.create(),cohortEntries=new Map();let stations=[],particles=[],selected='',hovered='',enabled=true,visible=true,cellsEnabled=true,density=1,scale=1,unit=3,view={x:0,y:0,w:1000,h:760},last=null,seconds=0,mode='inspect',session=0,lastNotice='',birthLifetime=4,currentKey=null,replayStyle='current',headAnchor='visible';
    let width=1000,height=760,dpr=1,displayScale=1,offsetX=0,offsetY=0,cellBudgetLimited=false,drawCalls=0;
    const CELL_BUDGET=12000;
    function resize(){const r=canvas.getBoundingClientRect?.()||{width:1000,height:760};width=Math.max(1,r.width);height=Math.max(1,r.height);dpr=Math.min(root.devicePixelRatio||1,2);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(directionCtx){directionCanvas.width=canvas.width;directionCanvas.height=canvas.height;}displayScale=Math.min(width/view.w,height/view.h);offsetX=(width-view.w*displayScale)/2;offsetY=(height-view.h*displayScale)/2;draw();}
    function inView(p){const margin=40*scale;return p.point.x>=view.x-margin&&p.point.x<=view.x+view.w+margin&&p.point.y>=view.y-margin&&p.point.y<=view.y+view.h+margin;}
    function reading(){return !enabled||mode==='final';}
    function cellMode(){return cellsEnabled&&G.cellVisibility(unit,scale,displayScale,!reading()).readable;}
    function patterned(p){return cellMode()&&(!cellBudgetLimited||p.station.id===selected||p.station.id===hovered);}
    function entries(){
      const active=births.active(seconds),activeIds=new Set(active.map(c=>c.id));for(const id of cohortEntries.keys())if(!activeIds.has(id))cohortEntries.delete(id);if(mode==='drain'&&!active.length)mode='final';
      if(reading()||mode==='inspect'||replayStyle==='current')return particles;
      // Historical cohorts always go down first; the selected frame is foreground.
      active.sort((a,b)=>Number(a.key===currentKey)-Number(b.key===currentKey)||a.bornAt-b.bornAt||a.id-b.id);
      return active.flatMap(c=>{if(!cohortEntries.has(c.id))cohortEntries.set(c.id,c.stations.map(station=>({station,point:C.project(station.lon,station.lat),cohort:c,seed:0})));return cohortEntries.get(c.id);});
    }
    function geometry(p,index=0,includeCells=true){return p.cohort?B.geometry(p.station.speed,seconds-p.cohort.bornAt,scale,p.cohort.unit,includeCells,p.cohort.lifetime):M.geometry(p.station.speed||0,p.seed+seconds/M.duration,index,(mode==='inspect'||mode==='final')?density:1,scale,unit,reading(),includeCells);}
    function paintAge(p){
      if(!p.cohort)return{current:true,alpha:1};
      const current=p.cohort.key===currentKey,progress=Math.max(0,Math.min(1,(seconds-p.cohort.bornAt)/p.cohort.lifetime));
      // Opacity encodes display age only, never confidence, direction or wind strength.
      return{current,alpha:current?1:.18+.52*(1-progress)};
    }
    function line(p,start,end,y){const r=G.rotateLocal(start,end,y,p.station.from);ctx.moveTo(p.point.x+r.x1,p.point.y+r.y1);ctx.lineTo(p.point.x+r.x2,p.point.y+r.y2);}
    function stroke(){ctx.stroke();drawCalls++;}
    function headGeometry(p,q){return G.directionHead(q,p.station,displayScale,headAnchor);}
    function draw(){
      drawCalls=0;const list=entries();if(!ctx)return;
      cellBudgetLimited=cellMode()&&list.reduce((sum,p)=>sum+(G.status(p.station)==='wind'&&inView(p)?Math.ceil(p.station.speed)*(p.cohort||mode==='replay'||mode==='drain'?1:density):0),0)>CELL_BUDGET;
      ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);if(directionCtx){directionCtx.setTransform(1,0,0,1,0,0);directionCtx.clearRect(0,0,canvas.width,canvas.height);}if(!visible)return;
      ctx.setTransform(dpr*displayScale,0,0,dpr*displayScale,dpr*(offsetX-view.x*displayScale),dpr*(offsetY-view.y*displayScale));ctx.save();ctx.beginPath();ctx.rect(view.x,view.y,view.w,view.h);ctx.clip();
      if(directionCtx){directionCtx.setTransform(dpr*displayScale,0,0,dpr*displayScale,dpr*(offsetX-view.x*displayScale),dpr*(offsetY-view.y*displayScale));directionCtx.save();directionCtx.beginPath();directionCtx.rect(view.x,view.y,view.w,view.h);directionCtx.clip();}
      for(const p of list){
        const st=p.station;if(G.status(st)!=='wind'||!inView(p))continue;
        const highlighted=st.id===selected||st.id===hovered,bodyWidth=highlighted?PAINT.selectedWidth:PAINT.normalWidth;ctx.lineCap='butt';ctx.globalAlpha=paintAge(p).alpha;
        for(let i=0;i<(p.cohort||mode==='replay'||mode==='drain'?1:density);i++){
          const drawCells=patterned(p),q=geometry(p,i,drawCells);if(q.visibleLength<.00001)continue;
          // A dark full-width outline makes the light-gray fill visible on light ground.
          // Butt caps and the same endpoints preserve the quantitative length exactly.
          ctx.lineWidth=bodyWidth/displayScale;ctx.strokeStyle=PAINT.outline;ctx.beginPath();line(p,q.start,q.end,q.y);stroke();
          ctx.lineWidth=(bodyWidth-2*PAINT.outlineInset)/displayScale;
          if(drawCells){ctx.strokeStyle=PAINT.light;ctx.beginPath();let any=false;for(const cell of q.clippedCells)if(cell.tone==='light'){line(p,cell.start,cell.end,q.y);any=true;}if(any)stroke();}
          if(drawCells){const boundaries=G.cellDividers(q,(p.cohort?.unit||unit)*scale,displayScale);if(boundaries.length){ctx.strokeStyle=PAINT.divider;ctx.beginPath();for(const d of boundaries)line(p,d.start,d.end,q.y);stroke();}}
          // Direction-only annotation at the visible TO end, including the exit clip edge.
          // Fixed CSS size does not round/extend the neutral quantitative body.
          const head=headGeometry(p,q);if(head.visible){const a=G.rotateLocal(head.x-head.length,head.x,head.y-head.halfWidth,st.from),b=G.rotateLocal(head.x-head.length,head.x,head.y+head.halfWidth,st.from),tip=G.rotateLocal(head.x,head.x,head.y,st.from);const target=directionCtx||ctx;target.globalAlpha=paintAge(p).alpha;target.lineWidth=head.strokePx/displayScale;target.strokeStyle=PAINT.tip;target.lineCap='butt';target.lineJoin='miter';target.beginPath();target.moveTo(p.point.x+a.x1,p.point.y+a.y1);target.lineTo(p.point.x+tip.x1,p.point.y+tip.y1);target.moveTo(p.point.x+b.x1,p.point.y+b.y1);target.lineTo(p.point.x+tip.x1,p.point.y+tip.y1);target.stroke();drawCalls++;}
        }
      }
      ctx.restore();ctx.globalAlpha=1;if(directionCtx){directionCtx.restore();directionCtx.globalAlpha=1;}
    }
    function advanceClock(now){if(document.hidden){last=null;return;}const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;if(mode==='replay'||mode==='drain'||enabled&&visible)seconds+=dt;births.active(seconds);}
    function tick(now){advanceClock(now);draw();const cs=births.state(seconds),notice=[mode,cs.length,cs[0]?.time,cs.at(-1)?.time].join('|');if(notice!==lastNotice){lastNotice=notice;if(onFrame)onFrame();}root.requestAnimationFrame(tick);}
    function emitFrame(rows,meta,age=0){currentKey=session+'|'+meta.time+'|'+meta.period;if(replayStyle==='current'){draw();return;}births.emit(rows,{key:currentKey,time:meta.time,period:meta.period,unit,bornAt:seconds-Math.max(0,age),now:seconds,lifetime:birthLifetime});draw();}
    function inspectEntry(p,index=0){const q=geometry(p,index);return{...q,...paintAge(p),...G.rotateLocal(q.start,q.end,q.y,p.station.from||0),station_id:p.station.id,speed:p.station.speed,from:p.station.from,anchor:{...p.point},seed:p.seed,status:G.status(p.station),cellsVisible:patterned(p)&&G.status(p.station)==='wind',head:headGeometry(p,q),dividers:patterned(p)?G.cellDividers(q,(p.cohort?.unit||unit)*scale,displayScale):[],birth:p.cohort?{id:p.cohort.id,time:p.cohort.time,period:p.cohort.period,bornAt:p.cohort.bornAt,lifetime:p.cohort.lifetime}:null};}
    const api={
      setData(rows,sharedUnit=null){stations=rows;currentKey=null;unit=sharedUnit===null?G.visualUnit(rows):Number(sharedUnit);if(!(unit>0&&Number.isFinite(unit)))throw new Error('유효하지 않은 표시 축척');particles=stations.map(station=>({station,point:C.project(station.lon,station.lat),seed:M.phaseForStation(station.id)}));draw();},
      startReplay(meta){births.clear();session++;mode='replay';emitFrame(stations,meta);},
      emitFrame(meta,age=0){if(mode==='replay'||mode==='drain')emitFrame(stations,meta,age);},
      finishReplay(){mode=replayStyle==='current'?'inspect':'drain';draw();},
      setHeadAnchor(value){if(!['physical','visible'].includes(value))throw new Error('지원하지 않는 화살표 기준');headAnchor=value;draw();},
      setReplayStyle(value){if(!['current','history'].includes(value))throw new Error('지원하지 않는 시각 표현');if(value===replayStyle)return;births.clear();cohortEntries.clear();currentKey=null;session++;replayStyle=value;if(mode==='drain'||mode==='final')mode='inspect';draw();},
      inspectMode(){births.clear();currentKey=null;session++;mode='inspect';draw();},
      setMotion(value){const next=Boolean(value);if(enabled===next)return;enabled=next;draw();},
      setVisible(value){const next=Boolean(value);if(visible===next)return;visible=next;draw();},
      setCells(value){const next=Boolean(value);if(cellsEnabled===next)return;cellsEnabled=next;draw();},
      setBirthLifetime(value){const next=Number(value);if(![2,4].includes(next))throw new Error('지원하지 않는 막대 수명');birthLifetime=next;},
      setDensity(value){const next=Math.max(1,Math.min(3,Number(value)));if(density===next)return;density=next;draw();},
      setScale(value){const next=Number(value);if(scale===next)return;scale=next;draw();},
      setSelection(id,hover=''){if(selected===id&&hovered===hover)return;selected=id;hovered=hover;draw();},
      setView(next){view={...next};resize();},resize,advanceClock,resetClock(){last=null;},
      inspect(id,index=0){const list=entries(),p=[...list].reverse().find(p=>p.station.id===id);return p?inspectEntry(p,index):null;},
      inspectBirths(id){return births.active(seconds).flatMap(c=>c.stations.filter(s=>s.id===id).map(station=>inspectEntry({station,point:C.project(station.lon,station.lat),cohort:c,seed:0})));},
      state(){const cs=births.state(seconds);return{enabled,visible,cellsEnabled,cellPixelWidth:unit*scale*displayScale,cellsReadable:cellMode(),cellBudgetLimited,cellBudget:CELL_BUDGET,drawCalls,density,effectiveDensity:mode==='inspect'||mode==='final'?density:1,scale,unit,seconds,stationCount:stations.length,particleLimit:mode==='inspect'||reading()||replayStyle==='current'?G.summarize(stations).wind*((mode==='inspect'||mode==='final')?density:1):cs.reduce((n,c)=>n+c.count,0),view:{...view},canvasAvailable:Boolean(ctx),directionLayerAvailable:Boolean(directionCtx),motionModel:'D-passage',replayStyle,headAnchor,head:G.HEAD,cycleSeconds:M.duration,birthLifetime,mode,currentKey,ageFade:{minimum:.18,maximum:.7,rule:'historical-normalized-display-age'},cohorts:cs,cohortCount:cs.length,paint:{...PAINT}};}
    };
    if(root.ResizeObserver)new root.ResizeObserver(resize).observe(canvas);resize();root.requestAnimationFrame(tick);return api;
  }
  root.StationParticleRenderer={create};
})(typeof window!=='undefined'?window:globalThis);
