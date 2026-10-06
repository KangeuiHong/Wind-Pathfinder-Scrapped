/* v0.10.0: exact observed samples and independently animated, approved D passage symbols. */
(function(){
  'use strict';
  const representation='baseline';
  const F=window.FlowModel,C=window.WindCore,O=window.ObservationsCore,L=window.ScreenLayout,D=window.DatasetCore,NS='http://www.w3.org/2000/svg',$=id=>document.getElementById(id);
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const datasets=[D.create(window.WIND_HISTORY)];
  let dataset=datasets[0],period=dataset.periods.includes(1)?1:dataset.periods[0],data=D.frameAt(dataset,0,period),selected='108',hovered='',motion=false,streaks=true,cells=true,density=1,scale=1,zoom=1,view={x:0,y:0,w:1000,h:760},generation=0,listLimit=40,search='',labelMode='sparse',birthLifetime=4,replayStyle='current';
  let stationById=new Map(data.stations.map(st=>[st.id,st]));const listNodes=new Map();
  let frameNow=0;const animationNow=()=>window.performance?.now?.()??frameNow;
  const ZOOMS=[1,1.5,2,3,4,6,8,12];let labelLayout=null,displayPolicy=null,drag=null,suppressMapClick=false;
  const nodes=new Map();const renderer=window.StationParticleRenderer.create($('particle-canvas'),()=>syncMotion(),$('direction-canvas'));
  const sampleClock=window.SampleClock.create(dataset.times.length,(index,event)=>showFrame(index,event));
  const dateFormatter=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function timeParts(){return Object.fromEntries(dateFormatter.formatToParts(new Date(data.time)).map(p=>[p.type,p.value]));}
  function el(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(parent)parent.append(e);return e;}
  function path(geometry){const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];return polygons.map(poly=>poly.map(ring=>ring.map((xy,i)=>{const p=C.project(xy[0],xy[1]);return(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2);}).join(' ')+'Z').join(' ')).join(' ');}
  el('path',{d:path(window.KOREA_GEOMETRY),'fill-rule':'evenodd'},$('land'));
  function windText(st){const s=O.status(st);return s==='missing'?'풍속 결측':s==='direction-missing'?`풍속 ${st.speed} m/s · 풍향 결측`:s==='calm'?'무풍 · 0 m/s':`${st.speed} m/s · FROM ${O.formatFromDirection(st.from)} · TO ${O.formatToDirection(st.from)}`;}
  function selectedStation(){return data.stations.find(s=>s.id===selected)||data.stations[0];}
  function buildMarkers(){
    $('observation-map').setAttribute('aria-label',`${data.stations.length}개 관측소. 지점 또는 검색 목록을 선택하세요`);
    $('stations').replaceChildren();nodes.clear();
    for(const st of data.stations){
      const p=C.project(st.lon,st.lat),status=O.status(st),g=el('g',{class:'station observed-station',transform:`translate(${p.x} ${p.y})`,role:'button',tabindex:st.id===selected?'0':'-1','data-station-id':st.id,'aria-label':`${st.name}, ${st.network}, ${windText(st)}`},$('stations'));
      const title=el('title',{},g);title.textContent=`${st.name} (${st.id}) · ${st.network} · ${windText(st)}`;
      const symbol=el('g',{class:'station-symbol'},g);
      el('circle',{r:5.5,class:'station-ring'},symbol);
      const halo=el('circle',{r:3.3,class:'station-halo '+status},symbol);
      const dot=el('circle',{r:2.5,class:'station-dot '+status},symbol);
      const missingMark=el('path',{d:'M-2.8 -2.8L2.8 2.8M-2.8 2.8L2.8 -2.8',class:'missing-mark'},symbol);
      const calmMark=el('circle',{r:3.2,class:'calm-mark'},symbol);
      const label=el('text',{x:7,y:-7,class:'station-label','data-station-label':st.id},symbol);label.textContent=st.name;label.style.fontSize='11px';label.style.strokeWidth='2.5px';
      el('circle',{r:5,class:'station-hit'},symbol);
      g.addEventListener('click',()=>selectStation(st.id));
      g.addEventListener('mouseenter',()=>{hovered=st.id;renderer.setSelection(selected,hovered);updateLabels();$('station-hover').textContent=`${st.name} (${st.id}) · ${windText(stationById.get(st.id))}`;});
      g.addEventListener('mouseleave',()=>{hovered='';renderer.setSelection(selected,'');updateLabels();$('station-hover').textContent='지점을 선택하면 원본 수치와 지역을 확인할 수 있습니다';});
      g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectStation(st.id);}else if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp'].includes(e.key)){e.preventDefault();if(e.shiftKey){const direction={ArrowRight:[-75,0],ArrowLeft:[75,0],ArrowDown:[0,-75],ArrowUp:[0,75]}[e.key];panView(...direction);}else{const i=data.stations.findIndex(s=>s.id===selected),delta=['ArrowRight','ArrowDown'].includes(e.key)?1:-1;selectStation(data.stations[(i+delta+data.stations.length)%data.stations.length].id);nodes.get(selected)?.g.focus?.();}}});
      nodes.set(st.id,{g,symbol,label,dot,halo,title,missingMark,calmMark,point:p});
    }
    renderer.setData(data.stations,dataset.visualUnit);renderer.setScale(scale);renderer.setDensity(density);renderer.setMotion(motion);renderer.setVisible(streaks);renderer.setCells(cells);renderer.setSelection(selected,hovered);
    updateMarkers();updateLabels();
  }
  function updateMarkers(){
    for(const st of data.stations){const n=nodes.get(st.id),status=O.status(st);n.dot.setAttribute('r',2.5);n.halo.setAttribute('class','station-halo '+status);n.dot.setAttribute('class','station-dot '+status);n.missingMark.style.display=status==='missing'||status==='direction-missing'?'':'none';n.calmMark.style.display=status==='calm'?'':'none';n.g.setAttribute('aria-label',`${st.name}, ${st.network}, ${windText(st)}`);n.title.textContent=`${st.name} (${st.id}) · ${st.network} · ${windText(st)}`;}
  }
  function mapMetrics(){const r=$('map').getBoundingClientRect?.()||{width:1000,height:760};return L.metrics(Math.max(1,r.width),Math.max(1,r.height),view);}
  function updateMapReference(m){
    // Inverse of WindCore.project: x = 180 + (lon-124)*80,
    // y = 720 - (lat-32.5)*100. Scale follows zoom, pan and letterboxing.
    const latitude=32.5+(720-(view.y+view.h/2))/100;
    const kmPerUnit=6371.0088*Math.PI/180*Math.cos(latitude*Math.PI/180)/80;
    const targetKm=100/m.scale*kmPerUnit,base=10**Math.floor(Math.log10(targetKm));
    const km=[1,2,5,10].map(v=>v*base).filter(v=>v<=targetKm).pop()||base;
    const pixels=km/kmPerUnit*m.scale,label=`약 ${Number(km.toPrecision(3))} km`;
    $('national-scale-label').textContent=label;
    $('national-scale-svg').setAttribute('width',String(pixels+4));
    $('national-scale-svg').setAttribute('viewBox',`0 0 ${pixels+4} 18`);
    $('national-scale-svg').setAttribute('aria-label',`${label}, 화면 중심 위도 ${latitude.toFixed(2)}도 기준 가로 거리`);
    $('national-scale-line').setAttribute('d',`M2 5V13M2 9H${pixels+2}M${pixels/2+2} 5V13M${pixels+2} 5V13`);
  }
  function updateLabels(){
    updateMapReference(mapMetrics());
    const m=mapMetrics(),entries=data.stations.map(st=>({id:st.id,...nodes.get(st.id).point}));displayPolicy=F.overviewStations(entries,zoom,[selected,hovered]);const displayIds=new Set(displayPolicy.ids);renderer.setDisplayIds(displayPolicy.ids);
    const onScreen=entries.filter(p=>{const x=m.offsetX+(p.x-view.x)*m.scale,y=m.offsetY+(p.y-view.y)*m.scale;return displayIds.has(p.id)&&x>=0&&x<=m.width&&y>=0&&y<=m.height;}).length;displayPolicy.inViewport=onScreen;
    $('display-count').textContent=`화면 ${onScreen} / 전체 ${data.stations.length}개 · ${displayPolicy.all?'전체 지점 표시':`전국 표시 대상 ${displayIds.size}개 · 4× 이상 전체`} · 검색은 전체`;
    labelLayout=L.placeLabels(data.stations.filter(st=>displayIds.has(st.id)).map(st=>({id:st.id,name:st.name,point:nodes.get(st.id).point})),{width:m.width,height:m.height,view,zoom,selected,hovered,labelMode});
    const labels=new Map(labelLayout.labels.map(label=>[label.id,label]));
    for(const st of data.stations){const n=nodes.get(st.id),active=st.id===selected,hot=st.id===hovered,label=labels.get(st.id);
      n.g.style.display=displayIds.has(st.id)?'':'none';n.g.setAttribute('aria-hidden',String(!displayIds.has(st.id)));n.g.setAttribute('data-displayed',String(displayIds.has(st.id)));
      n.symbol.setAttribute('transform',`scale(${m.inverse})`);n.symbol.setAttribute('data-screen-scale',String(m.inverse));
      n.label.style.display=label?'':'none';n.label.style.fontSize='11px';n.label.style.strokeWidth='2.5px';
      if(label){n.label.textContent=label.text;n.label.setAttribute('x',label.dx);n.label.setAttribute('y',label.dy);n.label.setAttribute('text-anchor',label.anchor);}
      n.g.classList.toggle('selected',active);n.g.classList.toggle('hovered',hot);n.g.setAttribute('aria-pressed',String(active));n.g.setAttribute('tabindex',active?'0':'-1');
    }
  }
  function renderList(){
    $('station-list').replaceChildren();listNodes.clear();const q=search.trim().toLocaleLowerCase();const matches=data.stations.filter(s=>`${s.id} ${s.name} ${s.network}`.toLocaleLowerCase().includes(q));
    for(const st of matches.slice(0,listLimit)){
      const btn=document.createElement('button');btn.type='button';btn.className='station-choice';btn.setAttribute('aria-pressed',String(st.id===selected));btn.setAttribute('aria-label',`${st.name}, 지점 ${st.id}, ${windText(st)}`);
      const name=document.createElement('span');name.textContent=st.name+' '+st.id;const value=document.createElement('strong');value.textContent=st.speed===null?'결측':String(st.speed);btn.append(name,value);btn.addEventListener('click',()=>selectStation(st.id));$('station-list').append(btn);listNodes.set(st.id,{btn,value});
    }
    $('search-count').textContent=`검색 ${matches.length}개 · 전체 ${data.stations.length}개`;$('more-stations').hidden=matches.length<=listLimit;
    if(!matches.length){const p=document.createElement('p');p.className='empty-search';p.textContent='일치하는 지점이 없습니다';$('station-list').append(p);}
  }
  function refreshListValues(){for(const[id,n]of listNodes){const st=stationById.get(id);n.value.textContent=st.speed===null?'결측':String(st.speed);n.btn.setAttribute('aria-pressed',String(id===selected));n.btn.setAttribute('aria-label',`${st.name}, 지점 ${st.id}, ${windText(st)}`);}}
  function updateDetails(){
    const st=selectedStation(),s=O.status(st);$('station-id').textContent=st.network+' '+st.id;$('station-name').textContent=st.name;
    $('station-coordinates').textContent=`${st.lat}° N · ${st.lon}° E`;window.AdminMap?.setStation(st);
    $('wind-value').textContent=st.speed===null?'—':String(st.speed);$('wind-value').classList.toggle('compact-value',$('wind-value').textContent.length>6);
    $('wind-caption').textContent=!st.rowPresent?(st.missingReason==='period-absent'?'이 시각의 해당 평균기간 자료 없음':'이 시각의 관측 행 없음'):s==='missing'?'원본 풍속 결측 · 이동 선분 없음':s==='direction-missing'?'풍향 결측 · 이동 선분 없음':s==='calm'?'원본값 0 · 무풍 표식':`전체 ${st.speed}칸 · 1칸 = 1 m/s · 소수 칸 보존`;
    $('from-value').textContent=O.formatFromDirection(st.from)+(Number.isFinite(st.from)&&s==='calm'?' (무풍)':'');
    $('to-value').textContent=s==='calm'?'무풍':O.formatToDirection(st.from);
    $('average-value').textContent=data.period===null?'미확인':data.period+'분 평균';$('qc-value').textContent=st.qc===null||st.qc===undefined?'정보 미제공':String(st.qc);
    $('sensor-note').textContent=(st.elevation===null||st.elevation===undefined?'지점 해발 미확인':`지점 해발 ${st.elevation} m`)+' · '+(st.sensorHeight===null||st.sensorHeight===undefined?'풍속계 높이 미확인':`풍속계 높이 ${st.sensorHeight} m`);
    $('value-state').textContent=data.source==='kma'?'기상청 원본 관측값':'사용자 CSV 값 · 출처 미검증';
    $('station-source').textContent=st.source?`행 출처: ${st.source}`:(data.source==='kma'?'출처: 기상청':'행 출처 미확인');
    renderSelectedReference(st);renderer.setSelection(selected,hovered);
    const exactDirection=O.status(st)==='wind';$('selected-direction').hidden=!exactDirection;if(exactDirection){$('selected-direction-arrow').setAttribute('transform',`rotate(${(st.from+180)%360} 20 20)`);$('selected-direction-text').textContent=`TO ${O.formatToDirection(st.from)} · ${st.speed} m/s`;}
    if(representation!=='baseline'&&exactDirection)$('wind-caption').textContent='현재 시각 원본값 · 지도 기호는 상대적 표현';
  }
  function renderSelectedReference(st){
    const svg=$('selected-reference');svg.replaceChildren();svg.setAttribute('aria-label',`${st.name} 풍속 전체 길이 기준, ${st.speed===null?'결측':st.speed+' m/s'}. 방향 표시와 별개입니다.`);
    $('reference-caption').textContent=st.speed===null?'풍속 결측 · 길이 기준 없음':st.speed===0?'무풍 · 0 m/s':`${st.speed} m/s = ${st.speed}칸 · 방향과 별개의 풍속 눈금`;
    if(st.speed===null||st.speed===0){el('text',{x:120,y:28,'text-anchor':'middle',class:'reference-empty'},svg).textContent=st.speed===0?'◎ 무풍':'⊗ 결측';return;}
    const unit=dataset.visualUnit*5,length=st.speed*unit,left=120-length/2,cells=O.speedCells(st.speed,1,unit),paint=window.WindPaint;
    el('rect',{x:left,y:15-paint.outlineInset,width:length,height:7+2*paint.outlineInset,fill:paint.outline,'data-reference-outline':'true'},svg);
    if(unit>=2)for(const cell of cells)el('rect',{x:left+cell.start,y:15,width:cell.end-cell.start,height:7,fill:paint[cell.tone]},svg);else el('rect',{x:left,y:15,width:length,height:7,fill:paint.dark},svg);
    if(unit>=2)for(const divider of O.cellDividers({speed:st.speed,barLeft:left,trackLeft:left,trackRight:left+length},unit,1))el('rect',{x:divider.start,y:15,width:divider.end-divider.start,height:7,fill:paint.divider,'data-cell-boundary':divider.index},svg);
    el('path',{d:`M${left},29 h${length}`,class:'reference-axis'},svg);const step=Math.max(1,Math.ceil(18/unit));
    const ticks=[];if(length>=30)for(let value=0;value<st.speed;value+=step)if(length-value*unit>=18)ticks.push(value);ticks.push(st.speed);
    for(const value of ticks){const x=left+value*unit;el('path',{d:`M${x},27 v5`,class:'reference-tick'},svg);el('text',{x,y:46,'text-anchor':'middle',class:'reference-tick-label'},svg).textContent=String(value);}
  }
  function selectStation(id){if(!nodes.has(id))return;selected=id;updateLabels();updateDetails();refreshListValues();}
  function updateLegend(){
    if(representation!=='baseline')return;
    const r=$('map').getBoundingClientRect?.(),physicalScale=r?Math.min(r.width/view.w,r.height/view.h):1,visibility=O.cellVisibility(dataset.visualUnit,scale,physicalScale,motion),state=renderer.state(),key=document.querySelector('.key-bar');
    // Choose a readable reference VALUE, never inflate its true map-scale length.
    const pixelUnit=dataset.visualUnit*scale*physicalScale,legendSpeed=[5,10,20,50,100].find(value=>value*pixelUnit>=24)||100,legendWidth=legendSpeed*pixelUnit,showCells=cells&&state.cellsReadable;
    key.style.width=legendWidth+'px';$('legend-measure').style.width=legendWidth+'px';$('legend-measure').setAttribute('data-reference-speed',String(legendSpeed));$('legend-measure').setAttribute('aria-label',`지도 실제 축척 ${legendSpeed} m/s 길이 기준. 관측 최댓값이 아닙니다.`);$('legend-value').textContent=`길이 기준 ${legendSpeed} m/s`;
    key.replaceChildren();for(let i=0;i<legendSpeed;i++){const cell=document.createElement('i');cell.style.width=(100/legendSpeed)+'%';cell.style.background=showCells?window.WindPaint[i%2?'dark':'light']:window.WindPaint.dark;cell.setAttribute('aria-hidden','true');key.append(cell);}
    const ticks=$('legend-ticks');ticks.replaceChildren();ticks.style.height=legendWidth<24?'23px':'12px';for(const value of legendWidth>=100?Array.from({length:legendSpeed+1},(_,i)=>i):[0,legendSpeed]){const tick=document.createElement('span');tick.textContent=String(value);tick.style.left=(value/legendSpeed*legendWidth)+'px';tick.style.top=legendWidth<24&&value===legendSpeed?'11px':'0px';tick.setAttribute('data-tick-value',value);ticks.append(tick);}key.setAttribute('data-cells',String(showCells));
    $('cell-status').textContent=!cells?'칸 구분 끔 · 전체 길이 기준':!state.cellsReadable?'칸이 작아 단색 표시 · 확대하면 구분':state.cellBudgetLimited?'혼잡해 선택·마우스 지점만 칸 구분':motion&&state.mode!=='final'?'1칸 = 1 m/s · 칸도 막대와 함께 이동':'1칸 = 1 m/s · 전체 막대 중앙 고정';
  }
  function applyView(){
    const box=[view.x,view.y,view.w,view.h].join(' ');$('map').setAttribute('viewBox',box);$('observation-map').setAttribute('viewBox',box);renderer.setView(view);
    $('zoom-value').textContent=zoom.toFixed(1)+'×';$('zoom-out').disabled=zoom===1;$('zoom-in').disabled=zoom===12;
    $('map').style.touchAction=zoom>1?'none':'pan-y';$('map').style.cursor=zoom>1?'grab':'';$('sea-labels').style.display=zoom>1?'none':'';updateLabels();updateLegend();
  }
  function setZoom(next,focus=null){const m=mapMetrics();zoom=Math.max(1,Math.min(12,next));view=L.zoomViewport(view,m.width,m.height,zoom,focus);applyView();}
  function panView(dx,dy){if(zoom<=1)return;view=L.pan(view,dx,dy,mapMetrics().scale);applyView();}
  $('map').addEventListener('pointerdown',e=>{if(zoom<=1||(e.button!==undefined&&e.button!==0))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,view:{...view},scale:mapMetrics().scale,moved:false};$('map').setPointerCapture?.(e.pointerId);e.preventDefault?.();});
  $('map').addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved=drag.moved||Math.hypot(dx,dy)>3;view=L.pan(drag.view,dx,dy,drag.scale);applyView();$('map').style.cursor='grabbing';});
  function stopDrag(e){if(!drag||e.pointerId!==drag.id)return;suppressMapClick=drag.moved;$('map').releasePointerCapture?.(e.pointerId);drag=null;$('map').style.cursor=zoom>1?'grab':'';}
  $('map').addEventListener('pointerup',stopDrag);$('map').addEventListener('pointercancel',stopDrag);
  $('map').addEventListener('click',e=>{if(suppressMapClick){suppressMapClick=false;e.preventDefault?.();e.stopPropagation?.();}},true);
  function syncMotion(){
    const playing=sampleClock.state().playing;
    $('motion-toggle').textContent=playing?'시각·바람 재생 중':motion?'Ⅱ 현재 시각 기호 멈춤':'▷ 현재 시각만 움직이기';
    $('motion-toggle').disabled=playing;$('motion-toggle').setAttribute('aria-pressed',String(motion));
    $('motion-status').textContent=!renderer.state().flow.canvasAvailable?'움직임 표시 미지원':!streaks?'관측점 보기 · 바람 기호 숨김':motion?'현재 관측 바람 · TO 방향으로 통과':'정지 · 현재 시각 전체 길이 고정';
    $('lifetime-note').textContent='주 재생·정지는 시각과 기호를 함께 제어 · 현재 시각만 움직이기는 별도 미리보기';
    $('birth-status').textContent=motion?'현재 시각의 한 방향만 표시 · 4초 반복 · 실제 경로 아님':'현재 시각의 전체 길이 · 끝 화살표는 풍속 길이에 더하지 않습니다';updateLegend();
  }
  function syncTimeControls(){
    const state=sampleClock.state();$('timeline').max=String(dataset.times.length-1);$('timeline').value=String(state.index);$('timeline').disabled=dataset.times.length===1;
    $('time-prev').disabled=state.index===0;$('time-next').disabled=state.index===dataset.times.length-1;$('time-play').disabled=dataset.times.length===1;
    $('time-play').textContent=state.playing?'Ⅱ 모두 멈춤':state.index===dataset.times.length-1&&dataset.times.length>1?'▶ 처음부터 재생':'▶ 시각·바람 재생';$('time-play').setAttribute('aria-pressed',String(state.playing));
    $('time-position').textContent=`${state.index+1} / ${dataset.times.length}개 시각`;
    $('time-gap').textContent=dataset.timeEvidence.status==='uncertain-live-header'?'자동응답 표기와 실제 관측시각 불일치 가능 · 시간 비교에 사용하지 마세요':data.gapBefore>0?`이전 기록과 ${data.intervalBefore/60000}분 간격 · 제공 자료에 중간 시각 없음`:data.intervalBefore>60000&&dataset.expectedIntervalMs===null?`이전 기록과 ${data.intervalBefore/60000}분 간격 · 수집 주기 미상`:dataset.times.length===1?'단일 시각 자료':'저장된 시각만 표시 · 보간 없음';
  }
  function shortTime(ms){return new Intl.DateTimeFormat('ko-KR',{timeZone:'Asia/Seoul',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms));}
  function updateSummary(){
    const count=O.summarize(data.stations),p=timeParts();$('valid-count').textContent=count.valid;$('station-count').textContent=count.total;$('missing-count').textContent=count.missing;$('calm-count').textContent=count.calm;
    $('date-label').textContent=`${p.year}.${p.month}.${p.day} · KST`;$('clock-time').textContent=p.hour+':'+p.minute+':'+p.second;$('map-time').textContent=p.hour+':'+p.minute+' KST';
    $('fixed-time-note').textContent=dataset.times.length===1?'저장된 단일 시각':'선택한 실제 관측시각';$('source-credit').textContent=data.source==='kma'?`출처: 기상청 · ${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute} KST`:'출처: 사용자 CSV · 별도 검증 필요';
    $('sample-badge').textContent=data.period===null?'평균기간 미상':data.period+'분 평균 관측';
    $('data-banner').classList.toggle('imported',data.source!=='kma');$('data-badge').textContent=data.source==='kma'?'OBSERVED':'CSV';
    $('data-description').textContent=`${data.source==='kma'?'기상청 저장 관측자료':'사용자 CSV · 출처 미검증'} · ${dataset.times.length}개 시각 · 전체 ${count.total}개 지점 / 현재 ${count.valid}개 값 있음 · 결측 ${count.missing}개`;
    const knownQC=data.stations.filter(st=>st.qc!==null&&st.qc!==undefined).length;$('qc-summary').textContent=knownQC?`QC 표기 ${knownQC}개 · 기준 미검증`:'QC 정보 미제공';
    $('period').value=D.keyOf(period);$('period-note').textContent=period===null?'평균기간 미상 · 원본 수치 그대로':'같은 시각의 평균기간 선택';
    if(dataset.timeEvidence.status==='uncertain-live-header'){$('clock-time').textContent='시각 미확정';$('date-label').textContent=`응답 표기 ${p.year}.${p.month}.${p.day} ${p.hour}:${p.minute} KST`;$('map-time').textContent='시각 미확정';$('fixed-time-note').textContent='15:32 표기값은 수동 조회 15:29 값과 일치';$('source-credit').textContent='출처: 기상청 자동응답 · 관측시각 미확정';$('data-description').textContent='보존용 자동응답 · 응답표기 15:32 / 수동조회 15:29 값과 일치 · 시각 비교에 사용하지 마세요';}
    $('range-start').textContent=shortTime(dataset.times[0]);$('range-end').textContent=shortTime(dataset.times.at(-1));syncMotion();syncTimeControls();
  }
  function showFrame(index,event={reason:'refresh'}){
    if(event.reason==='seek'||event.reason==='restart'){renderer.inspectMode();motion=false;renderer.setMotion(false);}
    data=D.frameAt(dataset,index,period);renderer.setObservedTime(data.time);stationById=new Map(data.stations.map(st=>[st.id,st]));
    if(nodes.size!==data.stations.length||!data.stations.every(st=>nodes.has(st.id)))buildMarkers();else{updateMarkers();renderer.setData(data.stations,dataset.visualUnit);renderer.setScale(scale);renderer.setDensity(density);renderer.setCells(cells);renderer.setMotion(motion);renderer.setVisible(streaks);renderer.setSelection(selected,hovered);}
    if(event.reason==='tick'){renderer.emitFrame({time:data.time,period},event.ageSeconds);if(event.isLast){renderer.finishReplay();motion=false;renderer.setMotion(false);}}
    refreshListValues();updateDetails();updateSummary();if(hovered&&stationById.has(hovered)){const st=stationById.get(hovered);$('station-hover').textContent=`${st.name} (${st.id}) · ${windText(st)}`;}
  }
  function loadDataset(next,{latest=true,preserveView=true}={}){
    const priorView={...view},priorZoom=zoom;renderer.inspectMode();
    dataset=next;period=dataset.periods.includes(1)?1:dataset.periods[0];data=D.frameAt(dataset,0,period);stationById=new Map(data.stations.map(st=>[st.id,st]));
    if(!stationById.has(selected))selected=data.stations[0].id;hovered='';$('station-hover').textContent='지점을 선택하면 원본 수치와 지역을 확인할 수 있습니다';search='';$('station-search').value='';listLimit=40;
    const select=$('period');select.replaceChildren();for(const p of dataset.periods){const option=document.createElement('option');option.value=D.keyOf(p);option.textContent=p===null?'평균기간 미상':p+'분 평균';select.append(option);}select.disabled=dataset.periods.length===1;
    sampleClock.setCount(dataset.times.length);buildMarkers();renderList();sampleClock.seek(latest?dataset.times.length-1:0);if(preserveView){view=priorView;zoom=priorZoom;applyView();}else setZoom(1);
  }
  $('period').addEventListener('change',e=>{const p=e.target.value==='unknown'?null:Number(e.target.value);if(dataset.periods.includes(p)){generation++;const now=animationNow();renderer.advanceClock(now);sampleClock.rebase(now);period=p;renderer.inspectMode();showFrame(sampleClock.state().index);if(sampleClock.state().playing)renderer.startReplay({time:data.time,period});syncMotion();}});
  $('timeline').addEventListener('input',e=>sampleClock.seek(Number(e.target.value)));
  $('time-prev').addEventListener('click',()=>sampleClock.step(-1));$('time-next').addEventListener('click',()=>sampleClock.step(1));
  $('time-play').addEventListener('click',()=>{if(sampleClock.state().playing){sampleClock.pause();renderer.inspectMode();motion=false;renderer.setMotion(false);}else{const now=animationNow();renderer.advanceClock(now);sampleClock.play(now);motion=true;renderer.setMotion(true);renderer.startReplay({time:data.time,period});}syncTimeControls();syncMotion();});
  $('label-mode').addEventListener('change',e=>{if(['all','sparse','off'].includes(e.target.value)){labelMode=e.target.value;updateLabels();}});
  $('play-rate').addEventListener('change',e=>{const now=animationNow();renderer.advanceClock(now);sampleClock.setRate(e.target.value,now);});
  function timeTick(now){frameNow=now;if(document.hidden)sampleClock.resetClock();else{renderer.advanceClock(now);sampleClock.tick(now);}window.requestAnimationFrame(timeTick);}
  window.requestAnimationFrame(timeTick);
  $('motion-toggle').addEventListener('click',()=>{motion=!motion;renderer.setMotion(motion);syncMotion();});
  if(reducedMotion.addEventListener)reducedMotion.addEventListener('change',e=>{if(e.matches){motion=false;renderer.setMotion(false);syncMotion();}});
  $('streaks-toggle').addEventListener('change',e=>{streaks=e.target.checked;renderer.setVisible(streaks);syncMotion();});
  $('scale').addEventListener('input',e=>{scale=Number(e.target.value);renderer.setScale(scale);$('scale-output').textContent=scale.toFixed(1)+'×';updateLegend();});
  $('station-search').addEventListener('input',e=>{search=e.target.value;listLimit=40;renderList();});$('more-stations').addEventListener('click',()=>{listLimit+=40;renderList();});
  $('seoul-preset').addEventListener('click',()=>{const seoul=stationById.get('108')||data.stations.find(st=>st.name==='서울');if(seoul){selected=seoul.id;updateDetails();refreshListValues();setZoom(6,C.project(seoul.lon,seoul.lat));}else{$('station-hover').textContent='이 자료에는 서울 관측소가 없습니다';}});
  $('zoom-in').addEventListener('click',()=>setZoom(ZOOMS.find(z=>z>zoom)||12));$('zoom-out').addEventListener('click',()=>setZoom([...ZOOMS].reverse().find(z=>z<zoom)||1));$('zoom-reset').addEventListener('click',()=>setZoom(1));
  $('help-button').addEventListener('click',()=>{$('help').hidden=!$('help').hidden;$('help-button').setAttribute('aria-expanded',String(!$('help').hidden));});
  document.addEventListener('visibilitychange',()=>{renderer.resetClock();sampleClock.resetClock();syncMotion();});
  if(window.ResizeObserver)new window.ResizeObserver(()=>{updateLabels();updateLegend();}).observe($('map'));
  renderer.setRepresentation('baseline');loadDataset(dataset);
  if(!renderer.state().canvasAvailable){$('import-status').hidden=false;$('import-status').textContent='이 브라우저에서 Canvas를 사용할 수 없어 이동 선분은 표시하지 못했습니다. 관측점과 원본 수치는 확인할 수 있습니다.';}
  window.windPrototypeState=()=>({version:'national-v0.10-consolidated',displayPolicy,windView:renderer.state().flow.presentation,representation,playing:sampleClock.state().playing,timeIndex:sampleClock.state().index,timeCount:dataset.times.length,playRate:sampleClock.state().rate,datasetId:dataset.id,timeEvidence:dataset.timeEvidence,visualUnit:dataset.visualUnit,missingRows:data.missingRows,interpolated:false,weatherTime:data.time,source:data.source,period:data.period,stations:data.stations.length,selected,zoom,labelMode,birthLifetime,replayStyle,counts:O.summarize(data.stations),motion,streaks,cells,density,scale,values:Object.fromEntries(data.stations.map(s=>[s.id,{speed:s.speed,from:s.from}]))});
  window.windPrototypeDatasetState=()=>({id:dataset.id,times:[...dataset.times],periods:[...dataset.periods],visualUnit:dataset.visualUnit,rowCount:dataset.rowCount});
  window.windPrototypeLayoutState=()=>({zoom,view:{...view},displayPolicy,...labelLayout});
  window.windPrototypeRenderState=()=>renderer.state();window.windPrototypeCompareHead=value=>renderer.setHeadAnchor(value);window.inspectStationBirths=id=>renderer.inspectBirths(String(id));window.inspectStationParticle=(id,index=0)=>renderer.inspect(String(id),index);
})();
