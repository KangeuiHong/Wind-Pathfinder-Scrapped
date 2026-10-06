# National v0.10 automated regression checks

Run from the app directory:

    node --test --test-reporter=tap national/tests/*.test.cjs

These 23 focused tests use the actual `NATIONAL_COMPARE.html`, its declared
script order, and its real initial elements. The harness returns `null` for
missing elements and does not add compatibility nodes for removed controls.

Coverage:

- Fixed original v0.10 startup with 638 stations, 61 stored timestamps and 1/10-minute source means
- All 77,836 station/frame/mean records retain their exact raw speed and FROM values
- KST timestamps and explicit separation from the 2024 Station dataset
- Current raw speed/FROM/TO hover and selection, full station and network search
- Geographic overview membership, selection retention, all stations at 4×, zoom and modeled pointer panning
- Seek, previous/next, primary play/pause, rate and mean changes, final stop and restart
- Fixed-time phase motion, discrete source turns, hidden-document clock handling
- Real calm, speed-missing, direction-missing and 0.1 m/s observations
- Original full-length bars, fractional cells, four-second passage geometry, TO rotation, quantitative legend and geographic north/scale
- All 18 preserved v0.11.1 source/model/renderer/data SHA-256 values
- Declared scripts, stylesheets, local page links and CSS resource existence

`v0111-preserved-hashes.json` is a test baseline copied from the supplied source
preservation manifest. The preserved comparison model/renderer hashes are also pinned in
the test source. The original legacy renderer remains byte-identical; the C comparison renderer is not loaded by the current page. Updating a hash requires deliberate source-change review.

## Limits

This is a JavaScript DOM and Canvas command model, not a browser. Passing it does
not establish rendered pixels, CSS layout, accessibility-engine behavior, native
input behavior, SVG hit-testing, real navigation, frame rate, perceptual clarity,
or visual acceptance. Browser visual QA has not been performed by this suite.

`national-tests.log` is the latest focused run. The app-level aggregate should
include `national/tests/*.test.cjs` alongside the existing suites.
