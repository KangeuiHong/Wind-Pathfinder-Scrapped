# Wind Matrix 데이터 계약 v1

데이터 계약은 `schemaVersion: "wind-matrix/1"`, `dateLocal: "2024-10-06"`, `timezone: "Asia/Seoul"`, `intervalMinutes: 1`, `averagingPeriodMinutes: 1`을 요구합니다. 실제 예시는 `matrix/data/jeonbuk-20241006.json`입니다.

## 자료 수준

- `kind`: `observed`, `test-fixture`, `unavailable`
- `windDirectionEncoding`: `kma-portal-mi1-avg-wd`, `kma-aws-minute-wd1`; `degrees-from-north`는 테스트 자료만 허용
- `sources[]`: 제목, 확인한 출처 URL과 설명
- `rawFiles[]`: 보존 원본 상대 경로와 SHA-256
- `records[]`: 원본 한 행씩 보존. 지점 ID, 시간, 수치, 원본 문자열, 출처 행, 확인 가능한 품질 정보

## 지점

`stations[]`에는 문자열 `id`, `name`, `network`, `acquisitionStatus`, `positions[]`가 있습니다.

- `acquisitionStatus: complete`: 요청한 하루 파일 전체를 확보·범위 확인했을 때만 사용. 행이 없는 분은 원본 행 결측으로 처리
- `partial`: 공개 표본 등 일부만 확보. `acquiredRanges`에 실제 확보 범위를 0–1439의 양 끝 포함 분 인덱스 쌍으로 명시. 그 밖의 빈 분은 ‘미확보’
- `unavailable`: 아직 해당 지점의 관측 파일을 확보하지 못함. 없는 관측을 결측으로 세지 않음

`positions[]`의 `lat`, `lon`, `validFrom`, `validTo`(배타적), `verified: true`, `source`가 모두 유효해야 당일 지점으로 표시합니다. 현대 위치를 과거 관측일에 자동 대입하지 않습니다. 지도는 선택한 시각의 역사 위치를 사용합니다.

## 관측 행

- `timestamp`: 명시적 시간대가 있는 ISO 문자열. 초가 00인 실제 관측시각만 허용, 원본은 그대로 보존
- `stationId`: 지점 문자열 ID
- `directionFromDeg`: 해석 가능한 원본 FROM 수치 또는 null. 출처별 특수 코드는 rawValues에 반드시 보존
- `speedMps`: 원본 1분 평균 m/s 수치 또는 null
- `rawValues`: 원본 열 이름과 원본 토큰. 문자열 소수 자릿수와 원본 코드 유지
- `sourceRow`: 원본 행 번호
- `quality: rejected`이면 표시 제외. 품질 플래그가 없는 것을 정상으로 간주하지 않음

FROM 0=N, 90=E, 180=S, 270=W로 확인된 각도만 TO=(FROM+180)%360으로 계산합니다. API WD1 360=무풍이며 방향 없음. 포털 MI1_AVG_WD 360은 의미 미확인으로 방향 없음. 0 m/s는 무풍 기호이며 화살표 없음. 공개 표본에 없는 특수값 규칙을 다른 출처에서 무단으로 가져오지 않습니다.

## 수치 유효성 및 검증

`valid`는 사용할 수 있는 수치 쌍 또는 풍속 0인 무풍 행이며 QC 통과를 뜻하지 않습니다. `missing`은 확보 범위 내 원본 행 부재·값 부재·오류·중복 등이며 세부 사유를 유지합니다. `unavailable`은 확보하지 않은 분입니다. 합계는 항상 1,440입니다.

같은 분에 여러 원본 행이 있으면 모두 보존하고 어느 것도 임의 선택·평균하지 않습니다. 다른 날짜·분이 아닌 시각·모르는 지점은 제외 목록에 원본과 사유를 남깁니다. 원본 수치를 보간·덮어쓰기·반올림하지 않습니다.

런타임 observed-data.js는 원본 풍향·풍속 토큰을 묶어 직렬화한 뒤 손실 없이 복원합니다. 14,390개 레코드 전체와 rawValues·sourceRow·timestamp를 풍부한 원본 JSON과 깊은 동등성으로 검사합니다. 결측 토큰과 `.2` 같은 원본 숫자 문자열을 유지합니다. 이는 표시/시간 압축이나 데이터 보간이 아닙니다.
