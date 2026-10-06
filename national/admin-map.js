/* Offline dated administrative boundaries and station locality, wind-only view. */
(function(){
  'use strict';
  const D=window.ADMIN_MAP_DATA,A=window.AdminCore,C=window.WindCore,NS='http://www.w3.org/2000/svg';
  if(!D||!A||!C)return;
  const $=id=>document.getElementById(id),provinceNodes=new Map(),districtNodes=new Map(),cache=new Map();
  let level='province',stationKey='',selectedLocality=null,selectedStation=null,inspectedCode='',inspectedFeature=null;
  const districtTitles=new Map();
  const activeDistricts=()=>level==='district';
  const colors=['#eef0e9','#e6e9e2','#eceee7','#e8ece6','#f0f1eb','#e5eae4'];
  function node(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
  function path(geometry){const polygons=geometry.type==='MultiPolygon'?geometry.coordinates:[geometry.coordinates];return polygons.map(poly=>poly.map(ring=>ring.map((xy,i)=>{const p=C.project(xy[0],xy[1]);return(i?'L':'M')+p.x.toFixed(2)+','+p.y.toFixed(2);}).join(' ')+'Z').join(' ')).join(' ');}
  function fullName(feature){const p=feature.properties;return p.province_name&&p.province_name!==p.name?p.province_name+' '+p.name:p.name;}
  function describe(feature){return fullName(feature)+' · '+D.metadata.boundary_vintage+' 경계 기준';}
  function setInspection(feature){
    inspectedFeature=feature;inspectedCode=feature?feature.properties.code:'';
    $('region-readout').textContent=feature?describe(feature):'지역 위에 마우스를 올리거나 목록에서 이름을 확인하세요';
    for(const [code,e]of provinceNodes)e.classList.toggle('inspected-region',!activeDistricts()&&level==='province'&&code===inspectedCode);
    for(const [code,e]of districtNodes)e.classList.toggle('inspected-region',activeDistricts()&&code===inspectedCode);
  }
  function addAreas(fc,group,nodes,isProvince){
    for(const [index,feature]of fc.features.entries()){
      const p=feature.properties,e=node('path',{d:path(feature.geometry),'fill-rule':'evenodd','vector-effect':'non-scaling-stroke',class:isProvince?'province-area':'district-area',id:(isProvince?'province-':'district-')+p.code,'data-region-code':p.code,'aria-label':describe(feature)},group);
      if(isProvince)e.setAttribute('fill',colors[index%colors.length]);
      const title=node('title',{},e);title.textContent=describe(feature);if(!isProvince)districtTitles.set(p.code,title);
      e.addEventListener('mouseenter',()=>{if(isProvince?!activeDistricts()&&level==='province':activeDistricts())setInspection(feature);});
      e.addEventListener('mouseleave',()=>setInspection(null));
      e.addEventListener('focus',()=>setInspection(feature));
      e.addEventListener('blur',()=>setInspection(null));
      e.addEventListener('click',()=>{if(isProvince?!activeDistricts()&&level==='province':activeDistricts()){$('region-select').value=p.code;setInspection(feature);}});
      nodes.set(p.code,e);
    }
  }
  addAreas(D.provinces,$('province-areas'),provinceNodes,true);
  addAreas(D.districts,$('district-areas'),districtNodes,false);
  // Independent, explicitly unfilled paths: do not clone a province's colored
  // source path through <use>, whose shadow-tree cascade may retain its fill.
  for(const feature of D.provinces.features)node('path',{d:provinceNodes.get(feature.properties.code).getAttribute('d'),fill:'none','fill-rule':'evenodd','vector-effect':'non-scaling-stroke',class:'temperature-province-outline','aria-hidden':'true'},$('province-outlines'));
  $('land').style.display='none';
  function showLevel(next){
    level=next;setInspection(null);
    $('admin-boundaries').setAttribute('data-level',level);
    for(const name of['province','district','none'])$('boundary-'+name).setAttribute('aria-pressed',String(level===name));
    $('district-areas').style.display=activeDistricts()?'':'none';
    $('admin-boundaries').setAttribute('data-temperature','false');
    const select=$('region-select');select.replaceChildren();select.disabled=level==='none';
    const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent=level==='none'?'경계 표시 꺼짐':'지역 이름 찾아보기';select.append(placeholder);
    const features=activeDistricts()?D.districts.features:D.provinces.features;
    for(const feature of features){const option=document.createElement('option');option.value=feature.properties.code;option.textContent=fullName(feature);select.append(option);}
    select.value='';
    updateStationHighlight();
  }
  for(const name of['province','district','none'])$('boundary-'+name).addEventListener('click',()=>showLevel(name));
  $('region-select').addEventListener('change',e=>{const fc=activeDistricts()?D.districts:D.provinces;setInspection(fc.features.find(f=>f.properties.code===e.target.value)||null);});
  $('region-select').addEventListener('focus',()=>{const fc=activeDistricts()?D.districts:D.provinces;const feature=fc.features.find(f=>f.properties.code===$('region-select').value);if(feature)setInspection(feature);});
  function locality(station){
    const key=station.lon+','+station.lat;
    if(!cache.has(key)){
      const provinces=A.locate(station.lon,station.lat,D.provinces),districts=A.locate(station.lon,station.lat,D.districts);
      const names=districts.length?districts.map(r=>fullName(r.feature)):provinces.map(r=>fullName(r.feature));
      const nearBoundary=districts.some(r=>A.boundaryDistanceM(station.lon,station.lat,r.feature.geometry)<100);
      const ambiguous=districts.length>1||provinces.length>1;
      const suffix=ambiguous?' (경계·중복 영역 · 확인 필요)':nearBoundary?' (경계 인근 · 확인 필요)':!districts.length&&names.length?' (시군구 미확인)':'';
      cache.set(key,{provinces,districts,names,nearBoundary,ambiguous,label:names.length?[...new Set(names)].join(' / ')+suffix:'경계 자료에서 확인되지 않음'});
    }
    return cache.get(key);
  }
  function updateStationHighlight(){
    const provinceCodes=new Set(selectedLocality?.provinces.map(r=>r.feature.properties.code)||[]),districtCodes=new Set(selectedLocality?.districts.map(r=>r.feature.properties.code)||[]);
    for(const[code,e]of provinceNodes)e.classList.toggle('station-region',!activeDistricts()&&level==='province'&&provinceCodes.has(code));
    for(const[code,e]of districtNodes)e.classList.toggle('station-region',activeDistricts()&&districtCodes.has(code));
  }
  function setStation(station){
    const key=[station.id,station.lon,station.lat].join('|');selectedStation=station;
    if(key!==stationKey){stationKey=key;selectedLocality=locality(station);}
    $('station-locality').textContent=selectedLocality.label;
    $('locality-vintage').textContent=D.metadata.boundary_vintage+' 경계 기준 · 현재 주소 인증 아님';
    updateStationHighlight();return selectedLocality;
  }
  $('boundary-vintage').textContent=D.metadata.boundary_vintage+' 경계 · 지역 구분용';
  $('admin-credit').textContent='SGIS 기반 / vuski · CC BY 4.0 · '+D.metadata.boundary_vintage;
  window.AdminMap={setStation,locality,state:()=>({level,inspectedCode,vintage:D.metadata.boundary_vintage,provinceCount:D.provinces.features.length,districtCount:D.districts.features.length,stationLocality:selectedLocality?.label||''})};
  showLevel('province');
})();
