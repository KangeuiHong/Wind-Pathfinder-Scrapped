'use strict';
// Standalone read-only preservation audit. It never writes inside either app.
// Capture: node audit-preservation.cjs --capture BASELINE_APP > baseline.json
// Compare: node audit-preservation.cjs --verify RELEASE_APP baseline.json
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const [mode, inputRoot, manifestPath] = process.argv.slice(2);
if (!['--capture', '--verify'].includes(mode) || !inputRoot || (mode === '--verify' && !manifestPath)) {
  console.error('Usage: node audit-preservation.cjs --capture APP | --verify APP BASELINE_JSON');
  process.exit(2);
}
const root = path.resolve(inputRoot);
const read = f => fs.readFileSync(path.join(root, f));
const sha = v => crypto.createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v)).digest('hex');
const M = require(path.join(root, 'matrix/core.js'));
const C = require(path.join(root, 'comparison/core.js'));
const R = require(path.join(root, 'comparison/render.js'));
const V = require(path.join(root, 'vector-comparison/core.js'));
const VR = require(path.join(root, 'vector-comparison/render.js'));
const E = require(path.join(root, 'orbit-event/core.js'));
const ER = require(path.join(root, 'orbit-event/render.js'));
const dataFiles = dir => fs.readdirSync(path.join(root, dir), {withFileTypes: true}).flatMap(e => e.isDirectory() ? dataFiles(dir + '/' + e.name) : [dir + '/' + e.name]).sort();
const preserveFiles = ['matrix/core.js', 'matrix/terrain.js', 'comparison/core.js', 'comparison/render.js', 'vector-comparison/core.js', 'vector-comparison/render.js', 'orbit-event/core.js', 'orbit-event/render.js', ...dataFiles('matrix/data')];
const fileHashes = Object.fromEntries(preserveFiles.map(f => [f, sha(read(f))]));
const context = {window: {WindMatrixCore: M}};
vm.runInNewContext(read('matrix/data/observed-data.js').toString(), context);
const input = context.window.WIND_MATRIX_DATA;
const untouched = JSON.stringify(input);
const normalized = JSON.parse(read('matrix/data/jeonbuk-20241006.json'));
assert.deepEqual(JSON.parse(untouched), normalized, 'Runtime data equals normalized source records and metadata');
assert.equal(input.records.length, 14390);
assert.equal(input.excludedRecords.length, 10);
const model = M.prepareDataset(input);
assert.equal(model.stations.length, 43);
const minutes = result => result.displayed.map(p => p.slot.minute);
const widths = [1, 220, 320, 375.5, 590, 700, 1180];
const svgCount = (svg, re) => [...svg.matchAll(re)].length;
const stationHashes = model.stations.map(raw => {
  const five = V.aggregate(raw, 5), ten = V.aggregate(raw, 10), step = V.step(raw), event = E.sample(raw);
  const eventMinutes = minutes(event);
  for (const width of widths) {
    const result = E.sample(raw, {viewportWidth: width});
    assert.deepEqual(minutes(result), eventMinutes, `${raw.station.id}: selection changes at width ${width}`);
    assert.ok(Math.abs(result.thresholdPx - 49.5 * width / 590) < 1e-10);
  }
  for (const edge of event.edges) {
    assert.equal(edge.from.run, edge.to.run);
    for (let m = edge.from.slot.minute; m <= edge.to.slot.minute; m++) assert.ok(E.project(raw.slots[m]), `${raw.station.id}: event bridges raw gap at ${m}`);
  }
  assert.equal(raw.slots.length, 1440);
  assert.equal(five.slots.length, 288);
  assert.equal(ten.slots.length, 144);
  const rawA = R.path(raw), rawB = R.polar(raw), eventSvg = ER.polar(raw, event);
  assert.equal(svgCount(rawA, /class="(?:plot-point|state-point)" data-minute="\d+"/g), 1440);
  assert.equal(svgCount(eventSvg, /class="event-point"/g), event.displayed.length);
  assert.equal(svgCount(eventSvg, /class="event-segment"/g), event.edges.length);
  assert.equal(svgCount(eventSvg, /hour-point|hour-label|mean-hour|mean-label|minute-hit-area/g), 0);
  assert.equal(sha(JSON.stringify(input)), sha(untouched), 'Numerical/render routines must not mutate source data');
  return {id: raw.station.id, counts: raw.counts,
    slots_sha256: sha(raw.slots), geometry_sha256: sha(C.build(raw)),
    raw_a_svg_sha256: sha(rawA), raw_b_svg_sha256: sha(rawB),
    five_sha256: sha(five), ten_sha256: sha(ten), step_sha256: sha(step),
    five_a_svg_sha256: sha(VR.path(five)), step_a_svg_sha256: sha(VR.path(step, 'step')),
    five_b_svg_sha256: sha(VR.polar(five)), ten_b_svg_sha256: sha(VR.polar(ten)),
    event_sha256: sha(event), event_svg_sha256: sha(eventSvg),
    event_minutes: eventMinutes, event_edges: event.edges.length, event_runs: event.runCount};
});
const jeonju = model.stations.find(s => s.station.id === '146');
assert.deepEqual([jeonju.counts.valid, jeonju.counts.calm, jeonju.counts.directional, jeonju.counts.missing, jeonju.counts.unavailable], [1439, 78, 1361, 0, 1]);
const jeonjuEvent = E.sample(jeonju);
assert.equal(jeonjuEvent.displayed.length, 43);
assert.equal(jeonjuEvent.edges.length, 42);
assert.deepEqual([jeonjuEvent.first.slot.minute, jeonjuEvent.end.slot.minute], [1, 1439]);
assert.deepEqual(jeonjuEvent.counts, {'first-observation': 1, distance: 41, 'final-endpoint': 1});
const buan = model.stations.find(s => s.station.id === '243');
assert.deepEqual([buan.counts.valid, buan.counts.missing, buan.counts.unavailable], [1424, 15, 1]);
for (let m = 1378; m <= 1392; m++) assert.equal(buan.slots[m].status, 'missing');
for (const raw of model.stations.filter(s => !s.counts.sourceRows)) {
  assert.equal(raw.counts.unavailable, 1440);
  assert.equal(E.sample(raw).displayed.length, 0);
}
const result = {schema: 'wind-consolidation-preservation/1', fileHashes,
  runtime_data_sha256: sha(input), normalized_source_sha256: sha(normalized),
  stations: stationHashes,
  summary: {stations: 43, records: 14390, excludedNextDayRows: 10, rawMinutes: 1440,
    jeonjuEventPoints: 43, jeonjuEventEdges: 42, responsiveWidths: widths,
    buanGapInclusive: [1378, 1392], browserQA: 'not run'}};
if (mode === '--capture') console.log(JSON.stringify(result, null, 2));
else {
  const baseline = JSON.parse(fs.readFileSync(manifestPath));
  // One explicitly recorded public-release exclusion. Keep the original baseline
  // intact: only the capture's file hash is excluded from this comparison.
  const exclusionsPath = path.join(root, 'verification/public-release-exclusions.json');
  if (fs.existsSync(exclusionsPath)) {
    const exclusions = JSON.parse(fs.readFileSync(exclusionsPath));
    assert.equal(exclusions.schema, 'wind-public-release-exclusions/1');
    assert.equal(exclusions.excludedFiles.length, 1);
    const excluded = exclusions.excludedFiles[0];
    assert.equal(excluded.path, 'matrix/data/source/raw/jeonju-20241006-wind-only-public-preview.html');
    assert.equal(excluded.sha256, baseline.fileHashes[excluded.path]);
    assert.equal(excluded.runtimeRequired, false);
    assert.equal(fs.existsSync(path.join(root, excluded.path)), false, 'Excluded portal capture must not be published');
    delete baseline.fileHashes[excluded.path];
  }
  // Normalize cross-realm arrays created by the offline runtime loader.
  assert.deepEqual(JSON.parse(JSON.stringify(result)), baseline, 'Retained data, core/render bytes, model results, or exact SVG outputs changed');
  console.log(JSON.stringify({result: 'PASS', retainedFiles: preserveFiles.length, exactStationSnapshots: stationHashes.length, ...result.summary}, null, 2));
}
