# CSV checker QA sample

This is a test example for my own browser-based CSV checker. It is **not client work**.

The Node test suite covers CSV quoting, BOM/CRLF input, text identifiers with leading zeroes, duplicate and incomplete product rows, inconsistent column counts, duplicate headers, and formula injection in downloadable reports. It also checks that malformed quotes raise a visible error instead of being accepted silently.

Run `node --test csv-audit.test.cjs` from this repository. The checker processes files in the browser and the test suite requires no account or paid service.

This sample demonstrates test design and a reproducible bug fix. It does not claim full security coverage, Shopify import certification, or experience testing a client's mobile app.
