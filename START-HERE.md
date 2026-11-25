# Knight Club
Install Node.js 22.13 or newer, unzip the project, and open a terminal in the folder containing package.json.

## Run locally
Run these commands in order:
```sh
npm ci
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_last_lilith.sql
npx wrangler d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_marvelous_slayback.sql
npm start
```
Open the address printed by the last command. Run the two database setup commands once per new database. On later launches, use npm start.

## Host games for a remote friend
The room service requires a Cloudflare Worker and D1 database. To use your own Cloudflare account:
1. Run npx wrangler login and npx wrangler d1 create knight-club.
2. In vite.config.ts replace the placeholder database ID with the returned ID and change the database_name to knight-club. Choose your own Worker name in the Worker configuration.
3. Run npm run build again.
4. Apply both SQL files in the same order using the commands above, replacing --local with --remote and omitting --persist-to .wrangler/state.
5. Run npx wrangler deploy --config dist/server/wrangler.json. Open the deployed URL and create your invite there.
