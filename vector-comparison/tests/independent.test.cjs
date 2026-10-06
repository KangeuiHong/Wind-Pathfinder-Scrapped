'use strict';

// Independent numerical/semantic checks. Does not modify the source data or app.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const M = require('../../matrix/core.js');
const C = require('../../comparison/core.js');
const V = require('../core.js');

const close = (actual, expected, tolerance = 1e-10) =>
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} differs from ${expected} by more than ${tolerance}`);
const bearingClose = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Number.isFinite(actual));
  const difference = Math.abs(actual - expected) % 360;
  assert.ok(Math.min(difference, 360 - difference) <= tolerance, `${actual} != ${expected}`);
};
const row = (minute, from, speed, extra = {}) => ({
  stationId: 'TEST', timestamp: M.timestampAt(minute),
  directionFromDeg: from, speedMps: speed,
  rawValues: { direction: String(from), speed: String(speed) }, sourceRow: minute + 2,
  ...extra
});
function fixture(records, acquisitionStatus = 'complete', acquiredRanges = []) {
  const input = {
    schemaVersion: 'wind-matrix/1', kind: 'test-fixture',
    windDirectionEncoding: 'degrees-from-north', dateLocal: M.DAY, timezone: M.ZONE,
    intervalMinutes: 1, averagingPeriodMinutes: 1,
    stations: [{ id: 'TEST', name: 'Independent test', acquisitionStatus, acquiredRanges, positions: [] }],
    records
  };
  return { input, entry: M.prepareDataset(input).stations[0] };
}
const aggregate = (records, width = 5) => V.aggregate(fixture(records).entry, width);
const laneRow = (minute, lane, speed = 2) => row(minute, (lane * 22.5 + 180) % 360, speed);
const step = records => V.step(fixture(records).entry);
const changes = output => output.events.filter(e => e.reason === 'sustained-change');
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

test('UMD builds the same numerical API without Node', () => {
  const context = { WindComparisonCore: C };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../core.js'), 'utf8'), context);
  assert.equal(typeof context.WindVectorCore.aggregate, 'function');
  close(context.WindVectorCore.vectorPair(2, 270).u, 2);
});

test('FROM cardinals become signed east/north TO vector components', () => {
  for (const [from, east, north] of [[0, 0, -2], [90, -2, 0], [180, 0, 2], [270, 2, 0], [360, 0, -2]]) {
    const vector = V.vectorPair(2, from);
    close(vector.u, east); close(vector.v, north);
  }
});

test('a measured zero speed is a zero vector even with no direction', () => {
  assert.deepEqual(V.vectorPair(0, null), { u: 0, v: 0 });
  for (const speed of [-1, NaN, Infinity, '2', null]) assert.equal(V.vectorPair(speed, 90), null);
  for (const from of [-1, 361, NaN, Infinity, '90', null]) assert.equal(V.vectorPair(2, from), null);
});

test('unequal-speed perpendicular winds use speed-weighted components, not angle means', () => {
  const slot = aggregate([row(0, 0, 4), row(1, 90, 2)]).slots[0];
  close(slot.u, -1); close(slot.v, -2);
  close(slot.record.speedMps, Math.sqrt(5));
  close(slot.scalarMeanSpeed, 3);
  bearingClose(slot.to, 206.56505117707798);
  bearingClose(slot.from, 26.565051177077976);
  assert.equal(slot.n, 2); assert.equal(slot.partial, true);
  assert.equal(slot.record.derived, true);
});

test('359 and 1 degrees wrap north correctly instead of averaging toward 180 FROM', () => {
  const slot = aggregate([row(0, 359, 2), row(1, 1, 2)]).slots[0];
  bearingClose(slot.from, 0); bearingClose(slot.to, 180);
  close(slot.record.speedMps, 2 * Math.cos(Math.PI / 180));
  close(slot.scalarMeanSpeed, 2);
});

test('opposite winds cancel, retaining scalar speed and an undefined direction', () => {
  const slot = aggregate([row(0, 0, 2), row(1, 180, 2)]).slots[0];
  assert.equal(slot.status, 'cancellation');
  assert.equal(slot.to, null); assert.equal(slot.from, null);
  assert.equal(slot.record.directionFromDeg, null);
  assert.equal(slot.record.speedMps, 0);
  close(slot.scalarMeanSpeed, 2);
  assert.equal(slot.calmCount, 0);
});

test('all observed calm differs from cancellation and has no direction', () => {
  const slot = aggregate([row(0, null, 0), row(1, 290, 0)]).slots[0];
  assert.equal(slot.status, 'calm'); assert.equal(slot.calmCount, 2);
  assert.equal(slot.n, 2); assert.equal(slot.to, null); assert.equal(slot.from, null);
  assert.equal(slot.record.speedMps, 0); assert.equal(slot.scalarMeanSpeed, 0);
});

test('observed calm participates in the mean denominator as an actual zero vector', () => {
  const slot = aggregate([row(0, 270, 4), row(1, null, 0)]).slots[0];
  assert.equal(slot.status, 'valid'); assert.equal(slot.n, 2); assert.equal(slot.calmCount, 1);
  close(slot.u, 2); close(slot.v, 0); close(slot.record.speedMps, 2);
  close(slot.scalarMeanSpeed, 2); bearingClose(slot.to, 90);
});

test('missing, rejected, and invalid source slots never enter either mean', () => {
  const records = [row(0, 270, 4), row(1, null, 99), row(2, 0, 99, { quality: 'rejected' }), row(3, 90, -4)];
  const slot = aggregate(records).slots[0];
  assert.equal(slot.n, 1); assert.equal(slot.missingCount, 4);
  close(slot.record.speedMps, 4); close(slot.scalarMeanSpeed, 4);
});

test('empty bins preserve missing versus unacquired status without fabricated zero means', () => {
  const missing = aggregate([]).slots[0];
  const unavailable = V.aggregate(fixture([], 'unavailable').entry, 5).slots[0];
  assert.equal(missing.status, 'missing'); assert.equal(missing.missingCount, 5);
  assert.equal(unavailable.status, 'unavailable'); assert.equal(unavailable.unavailableCount, 5);
  for (const slot of [missing, unavailable]) {
    assert.equal(slot.n, 0); assert.equal(slot.record, null); assert.equal(slot.scalarMeanSpeed, null);
    assert.equal(slot.u, null); assert.equal(slot.v, null); assert.equal(slot.to, null);
  }
});

test('fixed 5-minute and 10-minute bins have 288 and 144 half-open clock intervals', () => {
  const entry = fixture([]).entry;
  for (const width of [5, 10]) {
    const output = V.aggregate(entry, width);
    assert.equal(output.widthMinutes, width); assert.equal(output.slots.length, 1440 / width);
    output.slots.forEach((slot, index) => {
      assert.equal(slot.start, index * width); assert.equal(slot.minute, index * width);
      assert.equal(slot.end, (index + 1) * width); assert.equal(slot.expected, width);
    });
    assert.equal(output.slots.at(-1).end, 1440);
  }
  for (const width of [0, 1, 4, 15, '5']) assert.throws(() => V.aggregate(entry, width));
});

test('absent midnight yields 4/5 and 9/10 coverage without shifting boundaries or zero padding', () => {
  const records = Array.from({ length: 19 }, (_, i) => row(i + 1, 270, i < 9 ? 2 : 8));
  const entry = fixture(records, 'partial', [[1, 19]]).entry;
  for (const width of [5, 10]) {
    const first = V.aggregate(entry, width).slots[0];
    assert.equal(first.n, width - 1); assert.equal(first.expected, width);
    close(first.coverage, (width - 1) / width); assert.equal(first.partial, true);
    assert.equal(first.unavailableCount, 1); close(first.record.speedMps, 2);
  }
  close(V.aggregate(entry, 10).slots[1].record.speedMps, 8);
});

test('a boundary observation belongs only to the next bin', () => {
  for (const width of [5, 10]) {
    const slots = aggregate([row(width - 1, 270, 2), row(width, 90, 4)], width).slots;
    assert.equal(slots[0].n, 1); bearingClose(slots[0].to, 90); close(slots[0].record.speedMps, 2);
    assert.equal(slots[1].n, 1); bearingClose(slots[1].to, 270); close(slots[1].record.speedMps, 4);
  }
});

test('partial and calm-containing means cannot imply an uninterrupted connection', () => {
  const full = V.aggregate(fixture(Array.from({ length: 10 }, (_, i) => row(i, 270, 2))).entry, 5).slots;
  assert.equal(V.connectable(full[0], full[1]), true);
  for (const change of [{ n: 4, partial: true }, { calmCount: 1 }, { status: 'cancellation', to: null }]) {
    assert.equal(V.connectable({ ...full[0], ...change }, full[1]), false);
    assert.equal(V.connectable(full[0], { ...full[1], ...change }), false);
  }
  assert.equal(V.connectable(full[0], { ...full[1], minute: 10 }), false);
});

test('circular lane distance handles the north boundary and opposite directions', () => {
  for (let a = 0; a < 16; a++) for (let b = 0; b < 16; b++) {
    const delta = Math.abs(a - b);
    assert.equal(V.circularDistance(a, b), Math.min(delta, 16 - delta));
  }
  assert.equal(V.circularDistance(15, 0), 1);
  assert.equal(V.circularDistance(15, 1), 2);
  assert.equal(V.circularDistance(0, 8), 8);
});

test('a two-lane change requires all five qualifying minutes and takes effect only at the fifth', () => {
  const output = step([laneRow(0, 0), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 1, 2))]);
  assert.deepEqual(changes(output).map(e => [e.minute, e.candidateStart]), [[5, 1]]);
  for (let i = 1; i < 5; i++) {
    assert.equal(C.lane(output.slots[i].to), 0); assert.equal(output.slots[i].acceptedMinute, 0);
    assert.equal(output.slots[i].pendingCount, i); assert.equal(output.slots[i].held, true);
  }
  assert.equal(C.lane(output.slots[5].to), 2); assert.equal(output.slots[5].acceptedMinute, 5);
  assert.equal(output.slots[5].held, false); assert.equal(output.slots[5].pendingCount, 0);
});

test('speed threshold is inclusive at 1 m/s and independent of lane change', () => {
  const yes = step([laneRow(0, 0, 2), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 1, 0, 3))]);
  assert.deepEqual(changes(yes).map(e => e.minute), [5]);
  const no = step([laneRow(0, 0, 2), ...Array.from({ length: 8 }, (_, i) => laneRow(i + 1, 1, 2.999))]);
  assert.equal(changes(no).length, 0);
});

test('decimal source speeds at exactly 1 m/s qualify despite floating-point subtraction', () => {
  for (const [oldSpeed, newSpeed] of [[1.3, 2.3], [2.3, 1.3]]) {
    const output = step([laneRow(0, 0, oldSpeed), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 1, 0, newSpeed))]);
    assert.deepEqual(changes(output).map(e => e.minute), [5]);
  }
});

test('four qualifying observations do not create a confirmed change', () => {
  const output = step([laneRow(0, 0), ...Array.from({ length: 4 }, (_, i) => laneRow(i + 1, 4))]);
  assert.equal(changes(output).length, 0);
  assert.equal(output.slots[4].pendingCount, 4);
});

test('every candidate minute must still qualify versus last accepted, not prior raw minute', () => {
  const output = step([laneRow(0, 0), laneRow(1, 2), laneRow(2, 1), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 3, 2))]);
  assert.equal(output.slots[2].pendingCount, 0);
  assert.deepEqual(changes(output).map(e => [e.minute, e.candidateStart]), [[7, 3]]);
});

test('within-candidate tolerance is inclusive at one lane and 0.5 m/s', () => {
  const output = step([laneRow(0, 0, 1), laneRow(1, 3, 3), laneRow(2, 4, 3.5), laneRow(3, 2, 2.5), laneRow(4, 3, 3), laneRow(5, 4, 3.5)]);
  assert.deepEqual(changes(output).map(e => e.minute), [5]);
  assert.equal(C.lane(output.slots[5].to), 4);
  close(output.slots[5].record.speedMps, 3.5);
  assert.equal(output.slots[5].acceptedMinute, 5);
});

test('decimal source speeds at exactly 0.5 m/s stay inside the candidate tolerance', () => {
  for (const [anchorSpeed, laterSpeed] of [[0.6, 1.1], [1.1, 0.6]]) {
    const output = step([laneRow(0, 0, 2), laneRow(1, 3, anchorSpeed), ...Array.from({ length: 4 }, (_, i) => laneRow(i + 2, 3, laterSpeed))]);
    assert.deepEqual(changes(output).map(e => [e.minute, e.candidateStart]), [[5, 1]]);
  }
});

test('candidate accepts the fifth actual angle and speed, never the anchor or an average', () => {
  const records = [row(0, 180, 1), row(1, 248, 3), row(2, 250, 3.1), row(3, 253, 3.2), row(4, 256, 3.3), row(5, 259, 3.4)];
  const output = step(records);
  assert.deepEqual(changes(output).map(e => e.minute), [5]);
  bearingClose(output.slots[5].to, 79); close(output.slots[5].record.speedMps, 3.4);
  assert.equal(output.slots[5].raw.record, records[5]);
});

test('candidate stability uses its first sample, preventing adjacent-lane drift', () => {
  const output = step([laneRow(0, 0), laneRow(1, 3), laneRow(2, 4), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 3, 5))]);
  assert.equal(output.slots[3].pendingCount, 1);
  assert.deepEqual(changes(output).map(e => [e.minute, e.candidateStart]), [[7, 3]]);
});

test('candidate stability uses its first speed, preventing adjacent-speed drift', () => {
  const output = step([laneRow(0, 0, 1), laneRow(1, 0, 3), laneRow(2, 0, 3.4), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 3, 0, 3.8))]);
  assert.equal(output.slots[3].pendingCount, 1);
  assert.deepEqual(changes(output).map(e => [e.minute, e.candidateStart]), [[7, 3]]);
});

test('a speed jump just outside 0.5 m/s tolerance restarts the candidate', () => {
  const output = step([laneRow(0, 0, 1), laneRow(1, 0, 3), laneRow(2, 0, 3.500001), laneRow(3, 0, 3.500001), laneRow(4, 0, 3.500001), laneRow(5, 0, 3.500001)]);
  assert.equal(output.slots[2].pendingCount, 1); assert.equal(changes(output).length, 0);
});

test('north-wrap change threshold uses circular lanes, not absolute lane subtraction', () => {
  const one = step([laneRow(0, 15), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 1, 0))]);
  assert.equal(changes(one).length, 0);
  const two = step([laneRow(0, 15), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 1, 1))]);
  assert.deepEqual(changes(two).map(e => e.minute), [5]);
});

test('candidate stability also wraps over north', () => {
  const output = step([laneRow(0, 8), laneRow(1, 15), laneRow(2, 0), laneRow(3, 14), laneRow(4, 15), laneRow(5, 0)]);
  assert.deepEqual(changes(output).map(e => e.minute), [5]);
  assert.equal(C.lane(output.slots[5].to), 0);
});

test('after acceptance the new state becomes the reference for the next candidate', () => {
  const output = step([laneRow(0, 0, 1), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 1, 3, 3)), ...Array.from({ length: 5 }, (_, i) => laneRow(i + 6, 3, 2))]);
  assert.deepEqual(changes(output).map(e => [e.minute, e.candidateStart]), [[5, 1], [10, 6]]);
  close(output.slots[10].record.speedMps, 2);
});

test('missing and observed calm break candidates and remain honest non-directional slots', () => {
  for (const separator of [null, row(4, null, 0)]) {
    const records = [laneRow(0, 0), laneRow(1, 3), laneRow(2, 3), laneRow(3, 3), ...(separator ? [separator] : []), laneRow(5, 3), laneRow(6, 3)];
    const output = step(records);
    assert.equal(changes(output).length, 0);
    assert.equal(output.slots[4].status, separator ? 'calm' : 'missing');
    assert.equal(output.slots[4].to, null); assert.equal(output.slots[4].held, false);
    assert.equal(output.slots[4].acceptedMinute, null);
    assert.deepEqual(output.events.filter(e => e.reason === 'segment-start').map(e => e.minute), [0, 5]);
    assert.equal(output.slots[5].acceptedMinute, 5);
  }
});

test('unacquired minutes remain unacquired and never become held output', () => {
  const entry = fixture([laneRow(2, 3)], 'partial', [[2, 2]]).entry;
  const output = V.step(entry);
  assert.equal(output.slots.length, 1440);
  for (const minute of [0, 1, 3, 1439]) {
    assert.equal(output.slots[minute].status, 'unavailable');
    assert.equal(output.slots[minute].to, null); assert.equal(output.slots[minute].held, false);
  }
  assert.equal(output.events[0].minute, 2); assert.equal(output.events[0].reason, 'segment-start');
});

test('nonconsecutive valid minutes cannot accumulate a five-minute candidate', () => {
  const entry = fixture([laneRow(0, 0), laneRow(1, 3), laneRow(2, 3), laneRow(4, 3), laneRow(5, 3), laneRow(6, 3)]).entry;
  // Direct API edge case: explicitly omitted slot, rather than normal missing-slot padding.
  const output = V.step({ ...entry, slots: entry.slots.filter(s => s.minute !== 3) });
  assert.equal(changes(output).length, 0);
  assert.equal(output.slots.find(s => s.minute === 4).pendingCount, 1);
});

test('averaging and step leave deeply frozen input, Raw Matrix slots, and source tokens unchanged', () => {
  const records = Array.from({ length: 16 }, (_, i) => row(i, i * 22.5, i === 2 ? 0 : 2 + i / 10));
  const prepared = fixture(records);
  const before = JSON.stringify(prepared);
  deepFreeze(prepared);
  const mean5 = V.aggregate(prepared.entry, 5), mean10 = V.aggregate(prepared.entry, 10), stepped = V.step(prepared.entry);
  assert.equal(JSON.stringify(prepared), before);
  assert.notEqual(mean5.slots[0].record, records[0]); assert.notEqual(mean10.slots[0].record, records[0]);
  assert.notEqual(stepped.slots[0].record, records[0]);
  assert.equal(stepped.slots[0].raw.record, records[0]);
});

test('mean descriptions explicitly report actual denominator, partial coverage, and both speeds', () => {
  const slot = aggregate([row(1, 0, 4), row(2, 90, 2)]).slots[0];
  const description = V.describeMean(slot);
  assert.match(description, /\[00:00, 00:05\)/);
  assert.match(description, /2\/5분/); assert.match(description, /부분 구간/);
  assert.match(description, /벡터 크기 2\.236 m\/s/);
  assert.match(description, /풍속 산술평균 3 m\/s/);
});

test('all observed station bins match an independently computed component mean', () => {
  const input = JSON.parse(fs.readFileSync(path.join(__dirname, '../../matrix/data/jeonbuk-20241006.json'), 'utf8'));
  const entries = M.prepareDataset(input).stations.filter(entry => entry.counts.sourceRows);
  assert.equal(entries.length, 10);
  for (const entry of entries) for (const width of [5, 10]) {
    const output = V.aggregate(entry, width);
    for (const actual of output.slots) {
      const samples = entry.slots.slice(actual.start, actual.end).filter(slot => slot.status === 'valid' || slot.status === 'calm');
      assert.equal(actual.n, samples.length);
      if (!samples.length) { assert.equal(actual.record, null); continue; }
      let east = 0, north = 0, scalar = 0;
      for (const sample of samples) {
        const speed = sample.record.speedMps;
        scalar += speed;
        if (sample.status === 'calm') continue;
        const fromRadians = sample.record.directionFromDeg * Math.PI / 180;
        east -= speed * Math.sin(fromRadians); north -= speed * Math.cos(fromRadians);
      }
      east /= samples.length; north /= samples.length; scalar /= samples.length;
      const magnitude = Math.hypot(east, north);
      close(actual.u, east); close(actual.v, north);
      close(actual.record.speedMps, magnitude); close(actual.scalarMeanSpeed, scalar);
      assert.ok(actual.record.speedMps <= actual.scalarMeanSpeed + 1e-10);
      if (magnitude > V.EPSILON) bearingClose(actual.to, (Math.atan2(east, north) * 180 / Math.PI + 360) % 360);
      else assert.equal(actual.to, null);
    }
  }
});

test('actual Jeonju first bins and Buan missing-bin coverage match independent reference values', () => {
  const input = JSON.parse(fs.readFileSync(path.join(__dirname, '../../matrix/data/jeonbuk-20241006.json'), 'utf8'));
  const entries = M.prepareDataset(input).stations;
  const jeonju = entries.find(entry => entry.station.id === '146');
  const five = V.aggregate(jeonju, 5).slots[0], ten = V.aggregate(jeonju, 10).slots[0];
  assert.equal(five.n, 4); close(five.record.speedMps, 0.7721465429597102); close(five.scalarMeanSpeed, 0.775); bearingClose(five.to, 317.3666041325877);
  assert.equal(ten.n, 9); close(ten.record.speedMps, 0.7723446462978356); close(ten.scalarMeanSpeed, 0.7777777777777778); bearingClose(ten.to, 311.3613887525836);
  const buan = entries.find(entry => entry.station.id === '243');
  for (const [width, expected] of [[5, [283, 3, 2]], [10, [140, 3, 1]]]) {
    const bins = V.aggregate(buan, width).slots;
    assert.deepEqual([bins.filter(bin => bin.n === width).length, bins.filter(bin => bin.partial).length, bins.filter(bin => bin.n === 0).length], expected);
  }
});
