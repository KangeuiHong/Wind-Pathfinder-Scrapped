/* VISUAL/LOGIC TEST FIXTURE ONLY. Not observations, not historical weather. */
(function () {
  const C = window.WindMatrixCore;
  const records = Array.from({length: 1440}, (_, minute) => {
    const speedMps = +(0.4 + (Math.floor(minute / 23) % 70) / 10).toFixed(1);
    const directionFromDeg = (Math.floor(minute / 37) * 22.5) % 360;
    return { stationId: 'TEST', timestamp: C.timestampAt(minute), directionFromDeg, speedMps,
      rawValues: { WD1: String(directionFromDeg), WS1: String(speedMps) }, sourceRow: minute + 2 };
  });
  for (const i of [0, 122, 645, 1439]) { records[i].speedMps = 0; records[i].directionFromDeg = null; records[i].rawValues = { WD1: '', WS1: '0.0' }; }
  for (const i of [250, 251, 252, 780, 781]) { records[i].speedMps = null; records[i].directionFromDeg = null; records[i].rawValues = { WD1: '-99', WS1: '-99' }; }
  records[400].directionFromDeg = 360; records[400].rawValues.WD1 = '360';
  records[401].directionFromDeg = 0; records[401].rawValues.WD1 = '0';
  records[500].directionFromDeg = null; records[500].rawValues.WD1 = '-99';
  window.WIND_MATRIX_FIXTURE = {
    schemaVersion: 'wind-matrix/1', windDirectionEncoding: 'degrees-from-north', kind: 'test-fixture', dateLocal: C.DAY,
    timezone: C.ZONE, intervalMinutes: 1, averagingPeriodMinutes: 1,
    title: '명시적 검증용 가상 자료', sources: [{ title: '화면·로직 검증용 코드 생성값. 실제 날씨가 아닙니다.' }], rawFiles: [],
    acquisitionNote: '테스트 전용 · 실제 관측소와 무관한 합성값입니다. 실측 자료 또는 완성 결과로 사용할 수 없습니다.',
    stations: [{ id: 'TEST', name: '가상 검증 관측소', network: 'TEST', acquisitionStatus: 'complete', positions: [], note: '실제 관측소 아님 · 지도 위치 없음' }], records
  };
})();
