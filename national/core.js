/* Pure data/model helpers. Runs in a browser or Node; no dependencies. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WindCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const REQUIRED = ['station_id','name','lat','lon','time','wind_speed','wind_from_deg','temperature'];
  const MISSING = new Set(['','NA','N/A','NULL']);
  const STATIONS = [["108", "서울", 37.57142, 126.9658, 5.3, 250, 21.2], ["101", "춘천", 37.90262, 127.7357, 3.4, 305, 18.4], ["105", "강릉", 37.75147, 128.89099, 2.2, 40, 19.1], ["112", "인천", 37.47772, 126.6249, 3.8, 220, 20.7], ["115", "울릉도", 37.48129, 130.89863, 6.4, 25, 18], ["133", "대전", 36.37199, 127.3721, 4.2, 235, 22], ["146", "전주", 35.84092, 127.11718, 2.8, 280, 23.8], ["143", "대구", 35.87797, 128.65296, 4.8, 340, 24.1], ["156", "광주", 35.17294, 126.89156, 0, 0, 24.7], ["159", "부산", 35.10468, 129.03203, 5.8, 65, 23.5], ["165", "목포", 34.81732, 126.38151, 3.7, 295, 23], ["184", "제주", 33.51411, 126.52969, 4.6, 315, 25.2]];
  function demoCSV() {
    const rows=[REQUIRED.join(',')], start=Date.parse('2026-10-01T09:00:00+09:00');
    for(let minute=0;minute<=30;minute++) for(let i=0;i<STATIONS.length;i++) {
      const [id,name,lat,lon,base,from,temp]=STATIONS[i];
      let speed=minute===0?base:Math.max(0,base+1.2*Math.sin(minute/5+i)-1.2*Math.sin(i));
      let angle=(from+minute*3+8*Math.sin(minute/4+i)-8*Math.sin(i)+360)%360;
      if(i===8 && minute<3) speed=0;
      const missing=i===9 && minute<=2 || i===3 && minute>=12 && minute<=14;
      rows.push([id,name,lat,lon,new Date(start+minute*60000).toISOString(),missing?'':speed.toFixed(1),missing?'':angle.toFixed(1),i===6&&minute===10?'':(temp+1.2*Math.sin(minute/10)).toFixed(1)].join(','));
    }
    return rows.join('\r\n');
  }
  function parseCSVRows(text) {
    text=text.replace(/^\uFEFF/,'');
    const rows=[]; let row=[],field='',quoted=false,afterQuote=false;
    for(let i=0;i<text.length;i++) {
      const c=text[i];
      if(quoted) {
        if(c==='"') {if(text[i+1]==='"'){field+='"';i++;} else {quoted=false;afterQuote=true;}}
        else field+=c;
      } else if(c==='"') {
        if(field || afterQuote) throw new Error('CSV 따옴표 위치를 확인하세요.'); quoted=true;
      } else if(c===',') { row.push(field);field='';afterQuote=false; }
      else if(c==='\r'||c==='\n') {
        if(c==='\r'&&text[i+1]==='\n')i++;
        row.push(field); if(row.some(v=>v.trim()!==''))rows.push(row);
        row=[];field='';afterQuote=false;
      } else {
        if(afterQuote && c!==' '&&c!=='\t') throw new Error('닫는 따옴표 뒤에는 쉼표 또는 줄바꿈이 필요합니다.');
        if(!afterQuote)field+=c;
      }
    }
    if(quoted)throw new Error('CSV 따옴표가 닫히지 않았습니다.');
    row.push(field);if(row.some(v=>v.trim()!==''))rows.push(row);
    return rows;
  }
  function parseDataset(text) {
    if(typeof text!=='string'||text.length>5*1024*1024)throw new Error('CSV는 UTF-8, 5 MB 이하로 준비하세요.');
    const rows=parseCSVRows(text); if(rows.length<2)throw new Error('헤더와 1개 이상의 데이터 행이 필요합니다.');
    if(rows.length>50001)throw new Error('최대 50,000개 데이터 행을 지원합니다.');
    const headers=rows[0].map(x=>x.trim());
    if(new Set(headers).size!==headers.length)throw new Error('중복된 열 이름이 있습니다.');
    for(const key of REQUIRED)if(!headers.includes(key))throw new Error('필수 열이 없습니다: '+key);
    const stationMap=new Map(), samples=new Map(), timeSet=new Set(); let missingCount=0;
    for(let i=1;i<rows.length;i++) {
      const row=rows[i]; const err=msg=>{throw new Error((i+1)+'행: '+msg);};
      if(row.length!==headers.length)err('열 개수가 헤더와 다릅니다.');
      const get=k=>row[headers.indexOf(k)].trim();
      const number=(k,min,max,nullable=false)=>{
        const raw=get(k); if(MISSING.has(raw.toUpperCase())) {if(nullable)return null;err(k+' 값이 필요합니다.');}
        if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(raw))err(k+' 값은 숫자여야 합니다.');
        const n=Number(raw);if(!Number.isFinite(n)||n<min||n>max)err(k+' 범위: '+min+' ~ '+max);return n;
      };
      const id=get('station_id'), name=get('name');
      if(!/^[A-Za-z0-9_-]{1,40}$/.test(id))err('station_id는 영문·숫자·밑줄·하이픈 1~40자입니다.');
      if(!name||name.length>50)err('name은 1~50자입니다.');
      const lat=number('lat',32.5,39),lon=number('lon',124,132);
      const rawTime=get('time');
      if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?(?:Z|[+-]\d{2}:\d{2})$/.test(rawTime))err('time은 분 단위 ISO 8601 시각과 시간대가 필요합니다. 예: 2026-10-01T09:00:00+09:00');
      const time=Date.parse(rawTime);if(!Number.isFinite(time))err('유효하지 않은 time입니다.');
      // Date.parse can normalize February 30; verify the local calendar components.
      const parts=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(rawTime).slice(1).map(Number);
      const calendar=new Date(Date.UTC(parts[0],parts[1]-1,parts[2],parts[3],parts[4]));
      if(calendar.getUTCFullYear()!==parts[0]||calendar.getUTCMonth()+1!==parts[1]||calendar.getUTCDate()!==parts[2]||parts[3]>23||parts[4]>59)err('존재하지 않는 날짜 또는 시각입니다.');
      const speed=number('wind_speed',0,100,true), from=number('wind_from_deg',0,360,true),temperature=number('temperature',-80,65,true);
      const existing=stationMap.get(id);
      if(existing&&(existing.name!==name||existing.lat!==lat||existing.lon!==lon))err('같은 station_id의 이름·위치가 다릅니다.');
      if(!existing)stationMap.set(id,{id,name,lat,lon});
      if(stationMap.size>1000)err('최대 1,000개 관측소를 지원합니다.');
      if(!samples.has(time))samples.set(time,new Map());
      if(samples.get(time).has(id))err('같은 관측소·시각의 중복 행입니다.');
      const record={speed,from:from===360?0:from,temperature};
      if(speed===null||(speed>0&&from===null))missingCount++;
      samples.get(time).set(id,record);timeSet.add(time);
    }
    const times=[...timeSet].sort((a,b)=>a-b);
    return {stations:[...stationMap.values()],samples,times,rowCount:rows.length-1,missingCount};
  }
  const empty=()=>({speed:null,from:null,temperature:null});
  function nearestIndex(times,t) {
    let lo=0,hi=times.length-1;
    while(lo<hi){const m=Math.floor((lo+hi)/2);if(times[m]<t)lo=m+1;else hi=m;}
    return lo>0&&t-times[lo-1]<=times[lo]-t?lo-1:lo;
  }
  function bracket(times,t) {
    if(t<=times[0])return[0,0,0];
    if(t>=times[times.length-1])return[times.length-1,times.length-1,0];
    let lo=0,hi=times.length-1;
    while(hi-lo>1){const m=Math.floor((hi+lo)/2);if(times[m]<=t)lo=m;else hi=m;}
    if(t===times[lo])return[lo,lo,0]; if(t===times[hi])return[hi,hi,0];
    return[lo,hi,(t-times[lo])/(times[hi]-times[lo])];
  }
  function interpolate(a,b,f) {
    a=a||empty();b=b||empty();
    const speed=a.speed===null||b.speed===null?null:a.speed+(b.speed-a.speed)*f;
    let from=null;
    if(a.speed===0&&b.from!==null)from=b.from;
    else if(b.speed===0&&a.from!==null)from=a.from;
    else if(a.from!==null&&b.from!==null){const delta=((b.from-a.from+540)%360)-180;from=(a.from+delta*f+360)%360;}
    return {speed,from,temperature:a.temperature===null||b.temperature===null?null:a.temperature+(b.temperature-a.temperature)*f};
  }
  function frameAt(dataset,t) {
    const [a,b,f]=bracket(dataset.times,t),values=new Map(),gap=a!==b&&dataset.times[b]-dataset.times[a]>60000;
    for(const st of dataset.stations){const av=dataset.samples.get(dataset.times[a]).get(st.id);const bv=dataset.samples.get(dataset.times[b]).get(st.id);values.set(st.id,a===b?av||empty():gap?empty():interpolate(av,bv,f));}
    return {values,interpolated:a!==b&&!gap,gap,a,b,f};
  }
  function windStatus(v) { return v.speed===null?'missing':v.speed===0?'calm':v.from===null?'direction-missing':'wind'; }
  function downwind(from) { const r=from*Math.PI/180;return{x:-Math.sin(r),y:Math.cos(r),rotation:(from+90)%360,bearing:(from+180)%360}; }
  // A complete line segment translates in a short station-local neighborhood.
  // cycle advances with real elapsed time, independently of the weather clock.
  function particleGeometry(speed,cycle,index,scale=1,unit=12) {
    const length=Math.max(0,speed)*unit*scale;
    const velocity=Math.max(0,speed)*unit*scale*.3;
    const travel=Math.min(44*scale,velocity*2.4);
    const lifetime=velocity>0?travel/velocity:2.4;
    const progress=((cycle+index/3+.12)%1+1)%1;
    const center=(progress-.5)*travel;
    return {start:center-length/2,end:center+length/2,y:(index-1)*9*scale,length,velocity,travel,lifetime,progress,opacity:Math.pow(Math.sin(Math.PI*progress),.8)*(index===1?.95:.68)};
  }
  function project(lon,lat) {return{x:180+(lon-124)*80,y:720-(lat-32.5)*100};}
  return {REQUIRED,STATIONS,demoCSV,parseCSVRows,parseDataset,nearestIndex,bracket,interpolate,frameAt,windStatus,downwind,project,particleGeometry};
});
