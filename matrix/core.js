/* Wind Matrix: isolated minute-observation model. Never interpolates. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WindMatrixCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAY = '2024-10-06', ZONE = 'Asia/Seoul', SLOTS = 1440;
  const MINUTE = 60000, START = Date.parse(DAY + 'T00:00:00+09:00');
  const pad = n => String(n).padStart(2, '0');
  const timestampAt = index => {
    if (!Number.isInteger(index) || index < 0 || index >= SLOTS) throw Error('분 인덱스는 0–1439입니다');
    return `${DAY}T${pad(Math.floor(index / 60))}:${pad(index % 60)}:00+09:00`;
  };
  function timestampIndex(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return -1;
    const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/).slice(1).map(Number);
    const [y,m,d,h,min] = parts, check = new Date(Date.UTC(y,m-1,d,h,min));
    if (h > 23 || min > 59 || check.getUTCFullYear() !== y || check.getUTCMonth() !== m-1 || check.getUTCDate() !== d) return -1;
    const time = Date.parse(value), delta = (time - START) / MINUTE;
    return Number.isInteger(delta) && delta >= 0 && delta < SLOTS ? delta : -1;
  }
  function toBearing(from) {
    return typeof from === 'number' && Number.isFinite(from) && from >= 0 && from <= 360 ? (from + 180) % 360 : null;
  }
  function classify(record, encoding = 'degrees-from-north') {
    if (!record) return { status: 'missing', reason: 'record-absent', to: null };
    const speed = record.speedMps, from = record.directionFromDeg;
    if (record.quality === 'rejected') return { status: 'missing', reason: 'quality-rejected', to: null };
    if (speed === null || speed === undefined) return { status: 'missing', reason: 'speed-missing', to: null };
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0) return { status: 'missing', reason: 'speed-invalid', to: null };
    if (speed === 0) return { status: 'calm', reason: 'observed-zero-speed', to: null };
    const raw = record.rawValues || {};
    const originalDirection = encoding === 'kma-aws-minute-wd1' ? raw.WD1 : encoding === 'kma-portal-mi1-avg-wd' ? (raw.MI1_AVG_WD ?? raw['풍향(deg)']) : undefined;
    const sourceFrom = originalDirection === undefined || originalDirection === null || originalDirection === '' ? from : Number(originalDirection);
    if (encoding === 'kma-aws-minute-wd1' && sourceFrom === 360) return { status: 'missing', reason: 'calm-code-speed-conflict', to: null };
    if (encoding === 'kma-portal-mi1-avg-wd' && sourceFrom === 360) return { status: 'missing', reason: 'source-direction-code-unverified', to: null };
    if (from === null || from === undefined) return { status: 'missing', reason: 'direction-missing', to: null };
    const to = toBearing(from);
    if (to === null) return { status: 'missing', reason: 'direction-invalid', to: null };
    return { status: 'valid', reason: 'observed', to };
  }
  const SPEED_STOPS = [
    { max: 0, color: '#f7f7ed', label: '0' },
    { max: 1, color: '#eff6e8', label: '0–1' },
    { max: 2, color: '#d9ebd7', label: '1–2' },
    { max: 3, color: '#b9dcc8', label: '2–3' },
    { max: 5, color: '#89c3b5', label: '3–5' },
    { max: 8, color: '#58a8a3', label: '5–8' },
    { max: Infinity, color: '#367f88', label: '8+' }
  ];
  function speedColor(speed) {
    if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0) return null;
    return SPEED_STOPS.find(stop => speed <= stop.max).color;
  }
  function historicalPosition(station, timestamp) {
    const t = Date.parse(timestamp);
    const matches = (station.positions || []).filter(p => {
      const begin = Date.parse(p.validFrom), end = p.validTo ? Date.parse(p.validTo) : Infinity;
      return p.verified === true && typeof p.lat === 'number' && typeof p.lon === 'number' &&
        p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180 &&
        Number.isFinite(begin) && begin <= t && t < end && typeof p.source === 'string' && p.source.length > 0;
    });
    return matches.length === 1 ? matches[0] : null;
  }
  function prepareDataset(input) {
    if (!input || input.schemaVersion !== 'wind-matrix/1') throw Error('지원하는 스키마는 wind-matrix/1입니다');
    if (input.dateLocal !== DAY || input.timezone !== ZONE || input.intervalMinutes !== 1 || input.averagingPeriodMinutes !== 1) throw Error('2024-10-06 KST, 1분 간격·1분 평균 자료만 사용할 수 있습니다');
    if (!['observed', 'test-fixture', 'unavailable'].includes(input.kind)) throw Error('자료 종류를 명시해야 합니다');
    if (!Array.isArray(input.stations) || !Array.isArray(input.records)) throw Error('stations와 records 배열이 필요합니다');
    if (!['degrees-from-north', 'kma-aws-minute-wd1', 'kma-portal-mi1-avg-wd'].includes(input.windDirectionEncoding)) throw Error('풍향 인코딩을 명시해야 합니다');
    if (input.kind === 'observed' && input.windDirectionEncoding === 'degrees-from-north') throw Error('실측 자료는 확인된 출처별 풍향 인코딩이 필요합니다');
    if (input.kind === 'observed' && (!input.sources || !input.sources.length)) throw Error('실관측 자료는 출처가 필요합니다');
    if (input.kind === 'unavailable' && input.records.length) throw Error('미확보 자료에는 관측값을 넣을 수 없습니다');
    const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (input.sources !== undefined && (!Array.isArray(input.sources) || !input.sources.every(object))) throw Error('출처는 객체 배열이어야 합니다');
    if (input.rawFiles !== undefined && (!Array.isArray(input.rawFiles) || !input.rawFiles.every(f => typeof f === 'string' || object(f)))) throw Error('원본 파일 목록 형식이 올바르지 않습니다');
    if (input.excludedRecords !== undefined && !Array.isArray(input.excludedRecords)) throw Error('제외 원본 목록은 배열이어야 합니다');
    const seen = new Set();
    const stations = input.stations.map(station => {
      if (!object(station)) throw Error('관측소 항목은 객체여야 합니다');
      if (station.positions !== undefined && (!Array.isArray(station.positions) || !station.positions.every(object))) throw Error('관측소 위치 이력 형식이 올바르지 않습니다');
      if (station.acquiredRanges !== undefined && (!Array.isArray(station.acquiredRanges) || !station.acquiredRanges.every(r => Array.isArray(r) && r.length === 2 && r.every(Number.isInteger) && r[0] >= 0 && r[1] < SLOTS && r[0] <= r[1]))) throw Error('확보 범위는 0–1439의 분 인덱스 쌍이어야 합니다');
      if (typeof station.id !== 'string' || !station.id || seen.has(station.id)) throw Error('관측소 ID가 없거나 중복입니다');
      seen.add(station.id);
      if (!['complete', 'partial', 'unavailable'].includes(station.acquisitionStatus)) throw Error('관측소별 자료 확보 상태가 필요합니다');
      if (input.kind === 'unavailable' && station.acquisitionStatus !== 'unavailable') throw Error('미확보 자료의 상태가 충돌합니다');
      return station;
    });
    const index = new Map(stations.map(s => [s.id, new Map()]));
    const excluded = [];
    for (const record of input.records) {
      if (!record || !index.has(record.stationId)) { excluded.push({ record, reason: 'unknown-station' }); continue; }
      const minute = timestampIndex(record.timestamp);
      if (minute < 0) { excluded.push({ record, reason: 'outside-day-or-not-minute' }); continue; }
      const bucket = index.get(record.stationId);
      if (!bucket.has(minute)) bucket.set(minute, []);
      bucket.get(minute).push(record);
    }
    const prepared = stations.map(station => {
      const bucket = index.get(station.id), counts = { valid: 0, missing: 0, unavailable: 0, calm: 0, directional: 0, duplicate: 0, invalid: 0, sourceRows: 0 };
      const slots = Array.from({ length: SLOTS }, (_, minute) => {
        const records = bucket.get(minute) || [], record = records.length === 1 ? records[0] : null;
        let state;
        const covered = station.acquisitionStatus === 'complete' || (station.acquiredRanges || []).some(range => minute >= range[0] && minute <= range[1]);
        if (records.length > 1) { state = { status: 'missing', reason: 'duplicate-records', to: null }; counts.duplicate++; }
        else if (!record && !covered) state = { status: 'unavailable', reason: 'not-acquired', to: null };
        else state = classify(record, input.windDirectionEncoding);
        if (state.status === 'valid' || state.status === 'calm') counts.valid++;
        else counts[state.status]++;
        if (state.status === 'calm') counts.calm++;
        if (state.status === 'valid') counts.directional++;
        if (state.reason.endsWith('-invalid') || state.reason === 'quality-rejected') counts.invalid++;
        counts.sourceRows += records.length;
        return Object.assign({ minute, timestamp: timestampAt(minute), record, records }, state);
      });
      return { station, counts, slots };
    });
    const jeonju = prepared.find(s => s.station.id === '146');
    return { input, stations: prepared, excluded,
      preferredId: jeonju ? jeonju.station.id : null,
      representativeComplete: !!jeonju && jeonju.counts.valid === SLOTS,
      candidateChoiceRequired: !jeonju || jeonju.counts.valid !== SLOTS };
  }
  return { DAY, ZONE, SLOTS, START, timestampAt, timestampIndex, toBearing, classify, SPEED_STOPS, speedColor, historicalPosition, prepareDataset };
});
