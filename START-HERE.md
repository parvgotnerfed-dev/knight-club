# Host Knight Club on Cloudflare

Install Node.js 22.13 or newer. Extract this ZIP and open a terminal in the folder containing package.json.

```sh
npm ci
npx wrangler login
npx wrangler d1 create knight-club
```

Open vite.config.ts in a text editor. Set database_name to "knight-club", replace the placeholder database ID with the ID printed by Wrangler, and add name: "knight-club", inside localBindingConfig.

```sh
npm run build
npx wrangler d1 execute DB --remote --config dist/server/wrangler.json --file drizzle/0000_last_lilith.sql
npx wrangler d1 execute DB --remote --config dist/server/wrangler.json --file drizzle/0001_marvelous_slayback.sql
npx wrangler deploy --config dist/server/wrangler.json
```

Run the SQL commands once per new database. Open the website address Wrangler prints and use Create invite link to start a game with your friend.
