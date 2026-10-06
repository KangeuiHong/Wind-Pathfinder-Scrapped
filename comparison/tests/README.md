# Consolidated wind regression tests

Run all current tests from the application folder:

```sh
node --test comparison/tests/*.test.* vector-comparison/tests/*.test.cjs orbit-event/tests/*.test.cjs matrix/tests/*.test.js tests/*.test.cjs
node verification/audit-preservation.cjs --verify . verification/baseline.json
```

The original Station/Map suites cover 159 tests: raw comparison 20, raw encoding 11, raw B hour markers/preservation 10, vector/step numerical invariants 36, vector UI/rendering 10, event sampling/UI 24, Matrix data semantics 35, and canonical integration 13.

`dom-harness.cjs` loads the actual script tags in `VECTOR_COMPARE.html` by default. `createApp(hash, 'index.html')` exercises the Map-only page. It supplies explicit DOM, event, hash-history, and resize models. These are not browser tests and do not certify CSS layout, native SVG hit testing, actual ResizeObserver, accessibility-engine behavior, or local-file Back/Forward.

Current integration coverage:

- One canonical Station View with all seven plots and the 24×60 Raw Matrix
- Map-only entrypoint, 43 historical-location station markers, mouse/keyboard station routing, and station-preserving links
- Station dropdown and direct hash loading; Back/Forward refresh of raw, means, sustained step, event sampling, and source tokens
- Raw grid keyboard navigation, selected-minute state, bounded repeated clicks, and temporary versus pinned inspection
- Event click/keyboard selection synchronizes the exact raw minute; event hover stays temporary
- Empty AWS stations, Buan's 15-minute true data gap, calm with undefined TO, and missing midnight
- Responsive event sampling preserves all 43 Jeonju timestamps; zero-width initialization and recovery are safe
- Exact raw, mean, sustained-state, and event math/rendering/source SHA-256 preservation against `verification/baseline.json`
- Three canonical page routes: index.html (Map), VECTOR_COMPARE.html (Station), NATIONAL_COMPARE.html (National); no duplicate HTML IDs or missing local dependencies

Removed tests solely targeting deleted legacy pages are replaced by the integrated contracts. The previous 183-file historical archive lock and absent Python-cache lock do not define this release's preservation boundary. The two exact pre-existing five-minute output fixtures now live in `orbit-event/tests/fixtures/`.

The National page uses its own 2026-10-03 dataset and is separate from the 2024-10-06 Station data. Run its current suite with `node --test national/tests/*.test.cjs` when present.
