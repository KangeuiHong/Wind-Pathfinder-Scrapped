# 자료·출처·보존

전국 비교와 전북 Station은 날짜와 수집 경로가 다른 독립 자료입니다. 공개 배포용 파일 선별·코드 라이선스 상태는 [PUBLIC_RELEASE.md](PUBLIC_RELEASE.md)를 참고하세요.

## 전국 v0.10 비교 · 2026-10-03

NATIONAL_COMPARE.html은 **2026-10-03 14:32–15:32 KST**, 61개 저장 시각, 638개 관측소(ASOS 98·AWS 540)의 기상청 수동 조회 시계열을 사용합니다. 전북 Station의 2024-10-06 하루와 합치거나 같은 날짜로 표시하지 않습니다.

- 실행 자료: national/history-data.js
- 동일 정규화 자료와 CSV: national/data/history-20261003.json, national/data/history-20261003.csv
- 요청·반환 시각, 출처 URL, 수집 시각, 원본 HTML SHA-256: 각 프레임 provenance 및 national/data/history-source-manifest.json
- 이전 원자료 대조 결과: national/data/history-source-validation.json
- 공식 관측 원본 예시: https://www.kma.go.kr/cgi-bin/aws/nph-aws_txt_min?202610031432&0&MINDB_01M&0&m
- 관측소 메타데이터: https://www.weather.go.kr/w/weather/land/aws-obs.do
- 평균기간 설명: https://www.kma.go.kr/wnuri_help/html/observation/aws-table.jsp
- 기상청 자료 활용·출처 표시 안내: https://apihub.kma.go.kr/notice.do?seqNotice=57

1분·10분은 기상청 원본이 제공한 풍속·풍향의 평균기간입니다. 이번 화면이 새로 평균한 값이 아닙니다. 38,918개 관측소·시각의 원본 숫자와 결측, 좌표, 시각을 보존합니다. 이전 대조 결과에는 원본 숫자 셀 155,672개 검사가 기록되어 있으나, 원본 HTML 61개는 이 실행 패키지에 포함되어 있지 않아 이번에 그 원자료 대조를 다시 수행했다고 주장하지 않습니다. manifest의 raw/ 경로는 당시 보존 위치를 뜻합니다.

관측시각이 불확실했던 이전 자동응답 자료는 이번 페이지에 넣지 않았습니다. 저장된 수동 조회 61시각만 사용하며 새 날씨 조회·키·로그인·공간/시간 보간은 없습니다. 정규화 자료에 보존된 기온 필드는 바꾸지 않았지만 이번 바람 전용 화면에서는 표시·집계하지 않습니다. QC 플래그와 풍속계 높이는 미상이며, 현재 좌표의 2026-10-03 당시 과거 이력을 별도로 인증한 것은 아닙니다.

전국 바람 표현은 v0.11.1 묶음에 v0.10 원본으로 보존돼 있던 national/legacy-renderer.js와 풍속·방향·통과 모델을 그대로 사용합니다. 현재의 전국 표시 대상 정책과 화면 연결은 별도 어댑터가 유지합니다. national/preserved-source-hashes.json의 기존 18개 자료·모델·렌더러 해시는 바꾸지 않았습니다. C 비교 렌더러 파일은 보존돼 있지만 현재 페이지에서 불러오거나 실행하지 않습니다.

## 국가 윤곽 대체 지도

national/map-data.js의 국가 윤곽은 Natural Earth 1:50m Admin 0 Countries의 South Korea 피처입니다. 좌표를 소수점 5자리로 반올림해 오프라인 경로로 포함했습니다. 기본 표시는 아래 SGIS 유래 행정경계를 사용합니다.

- Attribution: Made with Natural Earth
- 자료: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_50m_admin_0_countries.geojson
- 공식 이용조건(public domain): https://www.naturalearthdata.com/about/terms-of-use/

소축척 시각화용 윤곽이며 법적 경계 확정이나 정밀 측량 자료가 아닙니다.

## 전북 Station 풍향·풍속 · 2024-10-06

사용자 제공 기상청 자료포털 ASOS 1분 평균 CSV를 보존했습니다. 관측일은 2024-10-06 KST, 풍향은 MI1_AVG_WD(FROM), 풍속은 MI1_AVG_WS(m/s)입니다.

- 원본: matrix/data/source/user-upload/OBS_ASOS_MI_20261006125115.csv
- SHA-256: c0e181df76e1ed75f39c8a5e90ed167cddaab3d9982d8eb0924c334623b41c74
- 510,512바이트, 지점마다 2024-10-06 00:01부터 다음 날 00:00까지 1,440행
- 대상일 원본 14,390행, 날짜 밖 다음 날 00:00 10행은 excluded-next-day-rows.json에 보존
- 정규화 전체: matrix/data/jeonbuk-20241006.json
- 로컬 실행용 무손실 직렬화: matrix/data/observed-data.js
- 검증: matrix/data/source/user-upload/validation-summary.json 및 core-validation.json
- 출처 URL·원본 파일·관측소 위치 이력은 위 JSON의 sources, rawFiles, stations와 matrix/data/source/에 함께 보존

TO=(FROM+180)%360은 표시값입니다. 원본 시각·FROM·풍속·빈 문자열·CSV 행을 보존하며 시간 이동, 빈칸 채움, 새로운 기상값 생성은 하지 않습니다. QC는 미확보입니다. 부안 22:58–23:12의 풍속 빈칸 15개는 결측, 각 지점 첫 00:00은 미확보입니다.

자료포털 MI1_AVG_WD의 원본 360은 해석이 확인되지 않았으므로 방향을 만들지 않습니다. API Hub WD1의 360 무풍 코드를 다른 출처에 자동 적용하지 않습니다.

## 관측소 이력

43개 전북 후보의 당일 확인 위치를 사용합니다. 2026년 포털 후보 목록에서 과거 위치 이력을 확인했으므로 2024년 전체 목록의 포괄성은 미확인입니다. ASOS 10곳은 원본 확보, AWS 33곳은 위치만 확인했습니다. 근거와 초기 공개 표본은 matrix/data/source/에 보존했습니다. preview/pending 파일은 출처·검증 보존용이며 실행 화면은 observed-data.js만 사용합니다. 과거 포털 HTML 캡처 1개는 세션 정보 위생을 위해 공개 묶음에서 제외했습니다. 기존 rawFile/rawFiles와 해시는 과거 출처 기록이며 해당 캡처가 포함됐다는 뜻이 아닙니다. 제외 내역은 verification/public-release-exclusions.json에 기록했습니다.

## 지형

공식 GEBCO_2024 음영기복도입니다. 로컬 포함 PNG이며 런타임 외부 요청이 없습니다.

- 이미지: matrix/data/jeonbuk-gebco-2024-relief.png
- 출처·요청 범위·SHA-256·라이선스: matrix/data/terrain-provenance.json
- 출처: https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2024-grid
- 이용조건: https://www.gebco.net/data-products/gridded-bathymetry/terms-of-use
- Attribution: Imagery reproduced from the GEBCO_2024 Grid. GEBCO Compilation Group (2024) GEBCO 2024 Grid, doi:10.5285/1c44ce99-0a0d-5f4f-e063-7086abc0ea0f

## 참고 경계

matrix/terrain.js의 전북 경계와 national/admin-data.js의 전국 경계는 기존 2025-01-01 기준 SGIS 유래 가공 경계입니다. 관측일 및 지형 편집판과 기준일이 다릅니다. 전북 화면은 원래 전국 경계 중 전북만 사용합니다. 전국은 원자료 3,555개 행정동을 17개 시도와 252개 지도 단위 시군구로 병합한 자료이며, 252는 기초자치단체 수를 뜻하지 않습니다.

본 데이터는 통계청 통계지리정보서비스(SGIS, https://sgis.kostat.go.kr)에서 공공누리 제1유형으로 개방한 행정동 경계를 가공한 것이며(가공: vuski/admdongkor, https://github.com/vuski/admdongkor), CC BY 4.0으로 배포됩니다. 경계 병합·좌표 자릿수 정리·속성 정규화 등 기존 가공 내역, 정확한 고정 원문 URL 및 이용조건은 data/admin-sources.json과 data/ADMIN-LICENSE.txt에 보존했습니다. 이번 정리에서 경계를 바꾸지 않았습니다. 법률·측량·재난 의사결정용이 아닙니다.
