/* Versioned observations, exact sample selection and CSV import. No renderer or interpolation. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./core.js'):root.WindCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.DatasetCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(C){
  'use strict';
  const SCHEMA='station-wind/1',MISSING=new Set(['','NA','N/A','NULL']);
  const REQUIRED=['station_id','name','lat','lon','time','wind_speed','wind_from_deg'];
  const KNOWN=[...REQUIRED,'schema_version','temperature','averaging_minutes','network','qc_flag','sensor_height_m','station_elevation_m','source','source_url'];
  const keyOf=p=>p===null?'unknown':String(p);
  function timeValue(raw){
    if(typeof raw!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:\.000)?(?:Z|[+-]\d{2}:\d{2})$/.test(raw))throw new Error('time은 시간대가 있는 분 단위 ISO 시각이어야 합니다.');
    const a=raw.slice(0,16).match(/\d+/g).map(Number),d=new Date(Date.UTC(a[0],a[1]-1,a[2],a[3],a[4])),ms=Date.parse(raw);
    if(!Number.isFinite(ms)||d.getUTCFullYear()!==a[0]||d.getUTCMonth()+1!==a[1]||d.getUTCDate()!==a[2]||a[3]>23||a[4]>59)throw new Error('존재하지 않는 날짜 또는 시각입니다.');
    return ms;
  }
  function number(value,name,min,max,nullable=true){if(value===null||value===undefined||MISSING.has(String(value).trim().toUpperCase())){if(nullable)return null;throw new Error(name+' 값이 필요합니다.');}if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(value).trim()))throw new Error(name+' 값은 숫자여야 합니다.');const n=Number(value);if(!Number.isFinite(n)||n<min||n>max)throw new Error(name+' 범위: '+min+' ~ '+max);return n;}
  function text(value,max=200){if(value===null||value===undefined||MISSING.has(String(value).trim().toUpperCase()))return null;const s=String(value).trim();if(s.length>max)throw new Error('메타데이터 문자열이 너무 깁니다.');return s;}
  function periodValue(value){const p=text(value);if(p===null||p==='unknown')return null;if(p==='1'||p==='10')return Number(p);throw new Error('averaging_minutes는 1, 10 또는 빈 값이어야 합니다.');}
  function networkName(value){const s=text(value,50);return s==='SS'?'ASOS':s==='SA'?'AWS':s;}
  function create(raw){
    if(raw.schema_version!==SCHEMA)throw new Error('지원하지 않는 자료 스키마입니다.');
    if(!Array.isArray(raw.stations)||!raw.stations.length||raw.stations.length>1000)throw new Error('관측소는 1~1,000개여야 합니다.');
    const stationMap=new Map();
    const stations=raw.stations.map(s=>{const id=String(s.id);if(!/^[A-Za-z0-9_-]{1,40}$/.test(id)||stationMap.has(id))throw new Error('관측소 ID 형식 또는 중복을 확인하세요.');const name=text(s.name,50);if(!name)throw new Error('관측소 이름이 필요합니다.');const st={id,name,lat:number(s.lat,'lat',32.5,39,false),lon:number(s.lon,'lon',124,132,false),network:networkName(s.network),sensorHeight:number(s.sensorHeight,'sensor_height_m',0,1000),elevation:number(s.elevation,'station_elevation_m',-500,9000),source:text(s.source),sourceUrl:text(s.sourceUrl,2000)};stationMap.set(id,st);return st;});
    if(!Array.isArray(raw.frames)||!raw.frames.length||raw.frames.length>1440)throw new Error('저장된 시각은 1~1,440개여야 합니다.');
    const seenTimes=new Set(),periods=new Set();let maximum=1,rowCount=0;
    const frames=raw.frames.map(f=>{const time=timeValue(f.time);if(seenTimes.has(time))throw new Error('같은 관측시각이 중복되었습니다.');seenTimes.add(time);const samples=new Map();
      for(const [periodKey,rows]of Object.entries(f.samples||{})){const period=periodValue(periodKey),key=keyOf(period);if(samples.has(key)||!Array.isArray(rows))throw new Error('평균기간 자료 형식을 확인하세요.');const values=new Map();
        for(const row of rows){const id=String(row.id);if(!stationMap.has(id)||values.has(id))throw new Error('관측소·시각·평균기간 중복 또는 미등록 관측소입니다.');const speed=number(row.speed,'wind_speed',0,100),from=number(row.from,'wind_from_deg',0,360);maximum=Math.max(maximum,speed||0);rowCount++;if(rowCount>200000)throw new Error('최대 200,000개 관측 행을 지원합니다.');
          const sample={speed,from,qc:typeof row.qc==='number'&&Number.isFinite(row.qc)?row.qc:text(row.qc),temperature:number(row.temperature,'temperature',-80,65)};
          for(const field of['network','sensorHeight','elevation','source','sourceUrl'])if(Object.hasOwn(row,field))sample[field]=field==='network'?networkName(row[field]):field==='sensorHeight'?number(row[field],'sensor_height_m',0,1000):field==='elevation'?number(row[field],'station_elevation_m',-500,9000):text(row[field],field==='sourceUrl'?2000:200);
          values.set(id,sample);
        }samples.set(key,values);periods.add(period);
      }if(!samples.size)throw new Error('관측시각마다 최소 한 평균기간이 필요합니다.');return{time,samples,provenance:f.provenance||{}};
    }).sort((a,b)=>a.time-b.time);
    return{schemaVersion:SCHEMA,id:text(raw.id)||'imported',title:text(raw.title)||'관측자료',sourceKind:raw.sourceKind==='kma'?'kma':'csv',provenance:raw.provenance||{},stations,frames,times:frames.map(f=>f.time),periods:[...periods].sort((a,b)=>(a??Infinity)-(b??Infinity)),visualUnit:Math.min(2,24/maximum),rowCount,expectedIntervalMs:number(raw.expectedIntervalMs,'expectedIntervalMs',60000,86400000),timeEvidence:raw.timeEvidence||{status:'user-supplied'},warnings:raw.warnings||[]};
  }
  function frameAt(dataset,index,period){
    if(!Number.isInteger(index)||index<0||index>=dataset.frames.length)throw new Error('시각 선택 범위를 벗어났습니다.');
    const f=dataset.frames[index],values=f.samples.get(keyOf(period)),stations=dataset.stations.map(st=>{const sample=values?.get(st.id);return{...st,...(sample||{speed:null,from:null,qc:null,temperature:null}),network:(sample&&Object.hasOwn(sample,'network')?sample.network:st.network)||'미상',time:f.time,period,rowPresent:Boolean(sample),missingReason:sample?null:values?'row-absent':'period-absent'};});
    return{stations,time:f.time,period,source:dataset.sourceKind,provenance:f.provenance,index,visualUnit:dataset.visualUnit,missingRows:stations.filter(s=>!s.rowPresent).length,periodAvailable:Boolean(values),gapBefore:index>0&&dataset.expectedIntervalMs!==null?Math.max(0,f.time-dataset.times[index-1]-dataset.expectedIntervalMs):null,intervalBefore:index>0?f.time-dataset.times[index-1]:0};
  }
  function fromKma(snapshot){return fromKmaHistory({schema_version:'kma-raw-history/1',provenance:snapshot.provenance,frames:[{observation_time:snapshot.provenance.observation_time,records:snapshot.records,provenance:snapshot.provenance}]},{id:'legacy-auto-header-1532',title:'보존 자료 · 자동응답 시각 미확정',timeEvidence:{status:'uncertain-live-header',reportedTime:snapshot.provenance.observation_time,matchedHistoricalTime:'2026-10-03T15:29:00+09:00',note:'응답 표기는 15:32이나 전체 풍속·풍향 값이 수동 조회 15:29와 일치합니다. 관측시각을 확정하거나 다시 붙이지 않습니다.'}});}
  function fromKmaHistory(raw,options={}){
    const stations=new Map(),frames=[];
    for(const f of raw.frames){const time=f.observation_time,ms=timeValue(time),samples={'1':[],'10':[]};
      for(const r of f.records){if(!['SS','SA'].includes(r.source_network_code))continue;if(timeValue(r.timestamp_kst)!==ms)throw new Error('응답 시각과 관측 행의 시각이 다릅니다.');const id=String(r.station_id),st={id,name:r.name_ko,lat:r.latitude,lon:r.longitude,network:r.source_network_code,elevation:r.station_elevation_m,sensorHeight:r.sensor_height_m,source:'기상청',sourceUrl:r.station_metadata_source_url||null};
        const old=stations.get(id);if(old&&(old.name!==st.name||old.lat!==st.lat||old.lon!==st.lon))throw new Error('시계열에서 같은 관측소의 이름·좌표가 바뀌었습니다. 확인 후 별도 자료로 분리하세요.');stations.set(id,st);
        for(const p of[1,10])samples[p].push({id,speed:r[`wind_speed_${p}min_ms`],from:r[`wind_direction_${p}min_deg`],qc:r.qc_flag,sensorHeight:r.sensor_height_m,elevation:r.station_elevation_m,network:r.source_network_code});
      }frames.push({time,samples,provenance:f.provenance||{}});
    }
    return create({schema_version:SCHEMA,id:options.id||'kma-history',title:options.title||'기상청 실제 시계열',sourceKind:'kma',provenance:raw.provenance,expectedIntervalMs:options.expectedIntervalMs??null,timeEvidence:options.timeEvidence||{status:'manual-archive'},stations:[...stations.values()],frames});
  }
  function parseCSV(input,filename='사용자 CSV'){
    if(typeof input!=='string'||input.length>20*1024*1024)throw new Error('CSV는 UTF-8, 20 MB 이하로 준비하세요.');
    const rows=C.parseCSVRows(input);if(rows.length<2||rows.length>200001)throw new Error('CSV는 1~200,000개 관측 행이 필요합니다.');const headers=rows[0].map(s=>s.trim());if(new Set(headers).size!==headers.length)throw new Error('중복된 열 이름이 있습니다.');for(const field of REQUIRED)if(!headers.includes(field))throw new Error('필수 열이 없습니다: '+field);
    const positions=new Map(headers.map((h,i)=>[h,i])),stations=new Map(),frames=new Map();
    for(let i=1;i<rows.length;i++){try{const row=rows[i];if(row.length!==headers.length)throw new Error('열 개수가 헤더와 다릅니다.');const get=k=>positions.has(k)?row[positions.get(k)].trim():'';const version=get('schema_version');if(positions.has('schema_version')&&version!==SCHEMA)throw new Error('schema_version은 '+SCHEMA+'이어야 합니다.');const id=get('station_id'),name=get('name'),lat=number(get('lat'),'lat',32.5,39,false),lon=number(get('lon'),'lon',124,132,false),ms=timeValue(get('time')),p=periodValue(get('averaging_minutes')),key=keyOf(p),network=networkName(get('network'));
      const old=stations.get(id);if(old&&(old.name!==name||old.lat!==lat||old.lon!==lon))throw new Error('같은 station_id의 이름·위치가 다릅니다.');if(!old)stations.set(id,{id,name,lat,lon,network});
      if(!frames.has(ms))frames.set(ms,{time:new Date(ms).toISOString(),samples:{}});const f=frames.get(ms);if(!f.samples[key])f.samples[key]=[];
      f.samples[key].push({id,speed:number(get('wind_speed'),'wind_speed',0,100),from:number(get('wind_from_deg'),'wind_from_deg',0,360),temperature:number(get('temperature'),'temperature',-80,65),qc:text(get('qc_flag')),network,sensorHeight:number(get('sensor_height_m'),'sensor_height_m',0,1000),elevation:number(get('station_elevation_m'),'station_elevation_m',-500,9000),source:text(get('source')),sourceUrl:text(get('source_url'),2000)});
    }catch(error){throw new Error((i+1)+'행: '+error.message);}}
    const extra=headers.filter(h=>!KNOWN.includes(h));return create({schema_version:SCHEMA,id:'csv',title:filename,sourceKind:'csv',provenance:{filename},stations:[...stations.values()],frames:[...frames.values()],warnings:extra.length?['지원하지 않는 추가 열을 사용하지 않았습니다: '+extra.join(', ')]:[]});
  }
  return{SCHEMA,REQUIRED,KNOWN,create,frameAt,fromKma,fromKmaHistory,parseCSV,timeValue,keyOf};
});
