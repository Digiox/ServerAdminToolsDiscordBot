# API Reference

Service that receives Server Admin Tools webhooks from Arma Reforger and will later relay them to Discord.

## Base URL
- Local development: `http://localhost:3000`
- Configure `PORT` env var to change the port.

## Authentication
- Not enforced yet. The payload includes a `token` field; validation will be added later.

## Endpoints

### Healthcheck
- `GET /health`
- Response `200 OK`:
  ```json
  { "status": "ok" }
  ```

### Receive events
- `POST /events`
- Accepts JSON or a JSON string even if sent as `application/x-www-form-urlencoded`.
- Request body:
  ```json
  {
    "token": "mytoken",
    "events": [
      {
        "name": "serveradmintools_player_killed",
        "title": "Player Killed",
        "data": {
          "player": "not bacon",
          "instigator": "not bacon",
          "friendly": 0
        },
        "timestamp": 1693589140
      }
    ]
  }
  ```
- Response `200 OK`:
  ```json
  { "received": 1, "recognized": 1, "handled": 1 }
  ```
- Response `400 Bad Request` when the payload cannot be parsed or `events` is missing.

### Currently implemented handling
- `serveradmintools_player_joined`: validates `player` (string), `identity` (string), `playerId` (number) then logs a structured message (placeholder for future Discord routing).
- `serveradmintools_player_killed`: validates `player` (string), `instigator` (string), `friendly` (boolean) and posts a kill feed message.
- `serveradmintools_game_started`: posts a simple “Game started” notification.
- `serveradmintools_game_ended`: posts end reason and optional winner.
- `serveradmintools_vote_started`: posts vote type/initiator/target.
- `serveradmintools_vote_ended`: posts vote result/winner/target.
- `serveradmintools_server_fps_low`: posts FPS, players, AI counts.
- `serveradmintools_admin_action`: posts admin action on a player.
- `serveradmintools_conflict_base_captured`: posts which base was captured and by which faction.

## Event names currently recognized
- serveradmintools_admin_action
- serveradmintools_conflict_base_captured
- serveradmintools_game_ended
- serveradmintools_game_started
- serveradmintools_player_joined
- serveradmintools_player_killed
- serveradmintools_server_fps_low
- serveradmintools_vote_ended
- serveradmintools_vote_started

## Examples

### Curl: healthcheck
```bash
curl -X GET http://localhost:3000/health
```

### Curl: send events
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "token": "mytoken",
    "events": [
      {
        "name": "serveradmintools_player_joined",
        "title": "Player Joined",
        "data": {
          "player": "not bacon",
          "identity": "dbf72344-3b61-4846-b3d8-9ed793ea254f",
          "playerId": 1
        },
        "timestamp": 1693589133
      }
    ]
  }'
```

## Discord slash commands
- `/set_default_channel channel:<text-channel>` — sets the fallback channel for bot messages.
- `/set_event_channel event:<event-name> channel:<text-channel>` — maps a specific Server Admin Tools event to a channel.
- `/setup_event_channels` — creates a category and one text channel per event, then links each event to its channel (and sets a default). Requires Manage Channels.
Requires `Manage Server` permission. Config is in-memory for now.

## Persistence
- SQLite at `./data/bot.sqlite` by default (override with `DB_PATH`).
- Mappings are keyed by guild ID; no cross-guild sharing.
- Set `DISCORD_PRIMARY_GUILD_ID` to choose which guild receives webhook event posts.
