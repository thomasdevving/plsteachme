> Historical iteration record. This is not verification of the current main replacement. See VERIFICATION.md for current checks.

# Performance measurement history

Each report belongs to the source configuration tested at that time. Trial configurations were removed; these rows are not repeated samples of the final build. Final accepted-build reports are named `lighthouse-final-site` and `lighthouse-final-site-devtools`. Raw JSON and HTML remain in `.impeccable/review/`.

| Report | Method | Performance | LCP (s) | TBT (ms) |
|---|---|---:|---:|---:|
| lighthouse-mobile.report.json | simulate | 95 | 2.59 | 145 |
| lighthouse-mobile-devtools.report.json | devtools | 96 | 1.88 | 189 |
| lighthouse-mobile-inline.report.json | simulate | 90 | 2.66 | 262 |
| lighthouse-trial-source-scan.report.json | simulate | 92 | 2.7 | 219 |
| lighthouse-mobile-deferred.report.json | simulate | 92 | 2.73 | 231 |
| lighthouse-mobile-critical-font.report.json | simulate | 92 | 2.11 | 294 |
| lighthouse-trial-critical-copy.report.json | simulate | 90 | 2.69 | 286 |
| lighthouse-trial-critical-copy-devtools.report.json | devtools | 90 | 2.13 | 304 |
| lighthouse-final-site.report.json | simulate | 95 | 2.49 | 180 |
| lighthouse-final-site-devtools.report.json | devtools | 97 | 1.61 | 166 |
