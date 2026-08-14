# Contributing to Viva

Use Node 24 and npm 11 as declared by `package.json`. Install dependencies with
`npm ci`, then run `npm run test:unit` and `VITE_BASE_PATH=/Viva/ npm run build`.

Data changes must use the manual ESPN candidate importer and include generated
types, validators, derived stats, draft output, and manifest updates in the
same change. Do not commit credentials, cookies, session payloads, or video
bytes. Keep Shotguns media references as stable keys and run
`npm run check:viva-media`.

Transactions and Player History remain out of scope for Viva V1. The only
credentialed ESPN operation is the reviewed `Refresh current season` GitHub
Actions workflow; it runs server-side, requires GitHub secrets for private
leagues, and must open a review PR rather than commit to `main`.
