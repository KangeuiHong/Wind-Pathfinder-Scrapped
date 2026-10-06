"""Build the app's preview adapter from verified raw-source research artifacts.
No wind values are interpolated, synthesized, changed or QC-approved here.
"""
import json,pathlib,shutil,hashlib
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=ROOT/'data'
OUT=pathlib.Path(__file__).resolve().parent/'data'
preview=json.loads((SOURCE/'jeonju-wind-preview-20241006.json').read_text())
roster=json.loads((SOURCE/'jeonbuk-station-history-20241006.json').read_text())
rows=preview['records']
stations=[]
for candidate in roster['stations']:
    historical=candidate['historicalPosition']
    position={'lat':historical['lat'],'lon':historical['lon'],'validFrom':historical['validFrom']+'T00:00:00+09:00','validTo':historical['validTo']+'T00:00:00+09:00' if historical['validTo'] else None,'verified':historical['verified'],'source':historical['evidence']['sourceUrl'],'evidence':historical['evidence']}
    is_jeonju=candidate['id']=='146'
    stations.append({'id':candidate['id'],'name':candidate['name'],'network':candidate['network'],'acquisitionStatus':'partial' if is_jeonju else 'unavailable','acquiredRanges':[[1,10]] if is_jeonju else [],'positions':[position],'note':('전주 우선 검토 · 00:01–00:10 실제 공개 표본 10분 · 전일 완전성 미확인' if is_jeonju else '당일 운영 이력 확인 후보 · 풍향·풍속 원본 미확보'),'sourceCoverage':candidate['coverage']})
sources=[{'title':'기상청 자료포털 · ASOS 분자료 공개 표본 (전주, 풍향·풍속만)','url':preview['sources'][0]['sourceUrl'],'note':'00:01–00:10의 실제 10행만 확보. 전일 파일은 로그인 후 다운로드가 필요합니다.'},{'title':'기상청 관측지점 이력','url':'https://data.kma.go.kr/tmeta/stn/selectStnList.do?pgmNo=123','note':'당일 유효 좌표 확인 43후보. 당시 전북 전체 지점을 모두 포함하는지는 아직 확인하지 못했습니다.'}]
(OUT/'source').mkdir(exist_ok=True)
# Public releases retain structured evidence, not portal HTML/session captures.
# See verification/public-release-exclusions.json for the original capture hash.
raw_files=[]
paths=['jeonju-wind-preview-20241006.json','jeonju-wind-preview-20241006.csv','jeonbuk-station-history-20241006.json','raw/jeonbuk-candidate-history-asos.csv','raw/jeonbuk-candidate-history-aws.csv']
for rel in paths:
    source=SOURCE/rel
    if source.exists():
        target=OUT/'source'/rel;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(source,target)
        raw_files.append({'path':'matrix/data/source/'+rel,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()})
result={'schemaVersion':'wind-matrix/1','kind':'observed','dateLocal':'2024-10-06','timezone':'Asia/Seoul','intervalMinutes':1,'averagingPeriodMinutes':1,'windDirectionEncoding':'kma-portal-mi1-avg-wd','title':'전북 · 2024-10-06 KST · 일부 원본 확보','acquisitionNote':'전주 00:01–00:10 실제 1분 관측 10건만 확보했습니다. 나머지 1,430분은 미확보이며 하루 전체 유효·결측 수는 아직 알 수 없습니다. QC 표시는 미확보입니다.','rosterNote':'당일 운영·좌표 이력 확인 후보 43곳 · 전북 전체 목록의 포괄성 미확인','sources':sources,'rawFiles':raw_files,'stations':stations,'records':rows,'originalSourceMetadata':preview['sources'],'warnings':preview['warnings']}
(OUT/'jeonbuk-20241006-preview.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
(OUT/'observed-preview.js').write_text('/* Genuine partial KMA wind data. Not a full-day result. */\nwindow.WIND_MATRIX_DATA = '+json.dumps(result,ensure_ascii=False,separators=(',',':'))+';\n')
print(f'Preserved {len(rows)} actual rows, {len(stations)} candidate station histories, {len(raw_files)} source files')
