# Contributing to Viva

Use Node 24 and npm 11 as declared by `package.json`. Install dependencies with
`npm ci`, then run `npm run test:unit` and `VITE_BASE_PATH=/Viva/ npm run build`.

Data changes must use the manual ESPN candidate importer and include generated
types, validators, derived stats, draft output, and manifest updates in the
same change. Do not commit credentials, cookies, session payloads, or video
bytes. Keep Shotguns media references as stable keys and run
`npm run check:viva-media`.

Transactions, Player History, scheduled league refreshes, and credentialed
ESPN calls are out of scope for Viva V1.
