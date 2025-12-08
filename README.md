# Server Admin Tools Discord Bot (skeleton)

Node.js + TypeScript service to receive Arma Reforger Server Admin Tools webhooks and route them to a Discord bot. This iteration focuses on structure, receiving the `/events` payload, and logging each event type.

## Requirements
- Node.js 18+
- npm

## Install
```bash
npm install
```

## Scripts
- `npm run dev` — start in watch mode with ts-node-dev.
- `npm run build` — type-check and emit to `dist/`.
- `npm start` — run the built server from `dist/`.

## API
See `docs/api.md` for detailed reference and examples.

### POST /events
Accepts the webhook body from the Server Admin Tools mod. The server attempts to parse JSON even when the mod sends `application/x-www-form-urlencoded`.

Expected shape:
```json
{
  "token": "mytoken",
  "events": [
    {
      "name": "serveradmintools_player_killed",
      "title": "Player Killed",
      "data": { "player": "not bacon", "instigator": "not bacon", "friendly": 0 },
      "timestamp": 1693589140
    }
  ]
}
```

Response:
```json
{ "received": 1, "recognized": 1 }
```

### GET /health
Simple health check.

## Postman
- Collection: `postman/ServerAdminToolsDiscordBot.postman_collection.json`
- Environment: `postman/ServerAdminToolsDiscordBot.postman_environment.json` (defines `baseUrl`, default `http://localhost:3000`).

## Discord (slash commands)
- `/set_default_channel` — choose the default text channel.
- `/set_event_channel` — map a specific event to a channel.
- `/setup_event_channels` — create a category plus one text channel per event and link them automatically.
Requires `DISCORD_APP_ID` and `DISCORD_TOKEN` in `.env`.

## Persistence
- SQLite (default `./data/bot.sqlite`, override with `DB_PATH`).
- Per-guild isolation: mappings keyed by guild_id.
- `DISCORD_PRIMARY_GUILD_ID` selects which guild receives webhook event posts.

## Implemented event routing
- `serveradmintools_player_joined`
- `serveradmintools_player_killed`
- `serveradmintools_game_started`
- `serveradmintools_game_ended`
- `serveradmintools_vote_started`
- `serveradmintools_vote_ended`
- `serveradmintools_server_fps_low`
- `serveradmintools_admin_action`
- `serveradmintools_conflict_base_captured`

## Event types tracked
- serveradmintools_admin_action
- serveradmintools_conflict_base_captured
- serveradmintools_game_ended
- serveradmintools_game_started
- serveradmintools_player_joined
- serveradmintools_player_killed
- serveradmintools_server_fps_low
- serveradmintools_vote_ended
- serveradmintools_vote_started

## Next steps
- Wire Discord client and per-event handling logic once event scripts are provided.
- Add validation for event payload shapes and token checking.
- Add tests around /events parsing and logging.
