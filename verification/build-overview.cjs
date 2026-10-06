'use strict';
// Actual bundled data and unchanged SVG renderers; an information-layout diagram, not a browser capture.
const fs=require('fs'),path=require('path'),M=require('../matrix/core.js'),R=require('../comparison/render.js'),V=require('../vector-comparison/core.js'),VR=require('../vector-comparison/render.js'),E=require('../orbit-event/core.js'),ER=require('../orbit-event/render.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../matrix/data/jeonbuk-20241006.json'))),raw=M.prepareDataset(data).stations.find(s=>s.station.id==='146'),five=V.aggregate(raw,5),ten=V.aggregate(raw,10),step=V.step(raw),event=E.sample(raw,{viewportWidth:590});
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'),inner=s=>s.replace(/^<svg[^>]*>/,'').replace(/<\/svg>$/,''),plot=(s,x,y,scale)=>`<g transform="translate(${x} ${y}) scale(${scale})">${inner(s)}</g>`;
const text=(s,x,y,size=18,fill='#294637',weight='400')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" font-weight="${weight}">${esc(s)}</text>`;
let svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="2280" viewBox="0 0 1440 2280"><rect width="1440" height="2280" fill="#f4f6f1"/><g font-family="Noto Sans CJK KR, sans-serif">`;
svg+=text('바람결 · 두 화면으로 정리한 구성',48,64,30,'#294637','700')+text('실제 자료·공유 SVG 렌더러로 만든 정적 도식 · 브라우저 화면 캡처가 아닙니다',48,97,16,'#687c6c');
svg+=`<rect x="48" y="126" width="1344" height="218" rx="15" fill="white" stroke="#dce4dd"/>`;
svg+=text('Map View',70,163,23,'#294637','700')+text('지형과 관측 위치를 보고 분석할 지점을 선택',70,192,17);
const terrain=fs.readFileSync(path.join(__dirname,'../matrix/data/jeonbuk-gebco-2024-relief.png')).toString('base64');svg+=`<image x="70" y="208" width="225" height="116" preserveAspectRatio="none" href="data:image/png;base64,${terrain}"/>`;
const project=([lon,lat])=>[70+(lon-125.8)/2.2*225,208+(36.4-lat)/1.1*116];for(const s of M.prepareDataset(data).stations){const p=M.historicalPosition(s.station,M.timestampAt(0));if(p){const[x,y]=project([p.lon,p.lat]);svg+=`<circle cx="${x}" cy="${y}" r="2" fill="${s.counts.valid?'#315e48':'white'}" stroke="#315e48" stroke-width=".6"/>`;}}
svg+=text('43개 지점',318,241,18)+text('지형·위치·확보 범위',318,272,16,'#687c6c')+text('→',592,257,32);
svg+=text('Station View',700,163,23,'#294637','700')+text('같은 하루의 원본·평균·상태변화를 비교',700,192,17)+text('B 3종 + A 3종 + 원자료 event sampling',700,240,18)+text('한 분 상세와 24×60 Raw Matrix는 한 곳에',700,272,18)+text('관측소 선택 공유 · 최종 방식 선택 전',700,307,16,'#687c6c');
svg+=text('B · 풍향과 풍속의 분포',48,387,23,'#294637','700');
for(const [i,label,s]of [[0,'1분 원본',R.polar(raw)],[1,'5분 벡터평균',VR.polar(five)],[2,'10분 벡터평균',VR.polar(ten)]]){const x=48+i*450;svg+=`<rect x="${x}" y="408" width="434" height="355" rx="12" fill="white" stroke="#dce4dd"/>`+text(label,x+20,442,18,'#294637','600')+plot(s,x+54,449,.55);}
svg+=text('A · 실제 시간축의 변화',48,804,23,'#294637','700')+text('상태 변화 기반 event sampling',921,804,23,'#294637','700');
const ap=[[R.path(raw),'1분 원본'],[VR.path(five),'5분 벡터평균'],[VR.path(step,'step'),'5분 지속 상태변화']];
for(let i=0;i<3;i++){const y=822+i*365;svg+=text(ap[i][1],48,y+15,15,'#294637','600')+plot(ap[i][0],44,y+22,.68);}
svg+=`<rect x="906" y="822" width="486" height="395" rx="12" fill="white" stroke="#dce4dd"/>`+plot(ER.polar(raw,event),972,835,.61)+text('1분 원자료 → 43점 · 검은 연결선 42개',930,1200,16);
svg+=`<rect x="48" y="1960" width="1344" height="264" rx="12" fill="white" stroke="#dce4dd"/>`+text('Raw Matrix · 모든 1분은 여기 한 곳에서',70,1997,23,'#294637','700')+text('전주 · 2024-10-06 KST · 1,440칸 색상 축약 미리보기 · 화살표·원본 상세는 앱에서 확인',70,2026,16,'#687c6c');
for(let h=0;h<24;h++)for(let m=0;m<60;m++){const s=raw.slots[h*60+m];svg+=`<rect x="${70+m*21.2}" y="${2042+h*6.7}" width="19.7" height="5.5" fill="${s.status==='valid'?M.speedColor(s.record.speedMps):s.status==='calm'?'#efeede':'#d9dfdc'}"/>`;}
svg+=text('이전 Matrix·별도 event 페이지·구형 전국 화면은 제거했습니다. 원본·계산·선택 시각은 보존했습니다',48,2255,16,'#687c6c')+'</g></svg>';
fs.writeFileSync(path.join(__dirname,'../review/layout-overview.svg'),svg);
console.log('review/layout-overview.svg');
