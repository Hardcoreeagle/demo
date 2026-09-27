# Netlify deployment

This project deploys as a static site from the `web` directory. The bundled
traceability data in `web/js/data-bundle.js` makes the main dashboard available
without a Go server.

## Deploy from the Netlify dashboard

1. Import this repository into Netlify.
2. Leave the build command empty.
3. Netlify will use `netlify.toml` and publish `web`.

The Netlify build also generates `web/js/blockchain-bundle.js` from the current
blockchain anchor and GS1 EPCIS records. The blockchain dashboard displays that
verification snapshot without a running server. The `traceability` Netlify
Function can optionally forward `/api/*` requests to a reachable Go API when
`TRACEABILITY_API_URL` is configured, enabling fresh live chain reads.