export const SERVER_EVENT_NAMES = [
  "serveradmintools_admin_action",
  "serveradmintools_conflict_base_captured",
  "serveradmintools_game_ended",
  "serveradmintools_game_started",
  "serveradmintools_player_joined",
  "serveradmintools_player_killed",
  "serveradmintools_server_fps_low",
  "serveradmintools_vote_ended",
  "serveradmintools_vote_started",
] as const;

export type ServerEventName = (typeof SERVER_EVENT_NAMES)[number];

export type EventData = Record<string, unknown>;

export interface ServerEvent<TName extends ServerEventName = ServerEventName> {
  name: TName;
  title: string;
  data: EventData;
  timestamp: number;
}

export interface EventBatchBody {
  token?: string;
  events?: ServerEvent[];
}

// Typed payloads
export interface PlayerJoinedData {
  player: string;
  identity: string;
  playerId: number;
}

export type PlayerJoinedEvent = ServerEvent<"serveradmintools_player_joined"> & {
  data: PlayerJoinedData;
};

export function isPlayerJoinedEvent(event: ServerEvent): event is PlayerJoinedEvent {
  return event.name === "serveradmintools_player_joined";
}

export interface PlayerKilledData {
  player: string;
  instigator: string;
  friendly: boolean;
}

export type PlayerKilledEvent = ServerEvent<"serveradmintools_player_killed"> & {
  data: PlayerKilledData;
};

export function isPlayerKilledEvent(event: ServerEvent): event is PlayerKilledEvent {
  return event.name === "serveradmintools_player_killed";
}

export type GameStartedEvent = ServerEvent<"serveradmintools_game_started"> & {
  data: Record<string, never>;
};

export function isGameStartedEvent(event: ServerEvent): event is GameStartedEvent {
  return event.name === "serveradmintools_game_started";
}

// Game ended
export interface GameEndedData {
  reason: string;
  winner?: string;
}

export type GameEndedEvent = ServerEvent<"serveradmintools_game_ended"> & {
  data: GameEndedData;
};

export function isGameEndedEvent(event: ServerEvent): event is GameEndedEvent {
  return event.name === "serveradmintools_game_ended";
}

// Vote started
export interface VoteStartedData {
  type: string;
  initiator: string;
  target: string;
}

export type VoteStartedEvent = ServerEvent<"serveradmintools_vote_started"> & {
  data: VoteStartedData;
};

export function isVoteStartedEvent(event: ServerEvent): event is VoteStartedEvent {
  return event.name === "serveradmintools_vote_started";
}

// Vote ended
export interface VoteEndedData {
  type: string;
  winner: string;
  target: string;
}

export type VoteEndedEvent = ServerEvent<"serveradmintools_vote_ended"> & {
  data: VoteEndedData;
};

export function isVoteEndedEvent(event: ServerEvent): event is VoteEndedEvent {
  return event.name === "serveradmintools_vote_ended";
}

// Server FPS low
export interface ServerFpsLowData {
  fps: number;
  players: number;
  ai_characters: number;
}

export type ServerFpsLowEvent = ServerEvent<"serveradmintools_server_fps_low"> & {
  data: ServerFpsLowData;
};

export function isServerFpsLowEvent(event: ServerEvent): event is ServerFpsLowEvent {
  return event.name === "serveradmintools_server_fps_low";
}

// Admin action
export interface AdminActionData {
  player: string;
  admin: string;
  action: string;
}

export type AdminActionEvent = ServerEvent<"serveradmintools_admin_action"> & {
  data: AdminActionData;
};

export function isAdminActionEvent(event: ServerEvent): event is AdminActionEvent {
  return event.name === "serveradmintools_admin_action";
}

// Conflict base captured
export interface ConflictBaseCapturedData {
  faction: string;
  base: string;
}

export type ConflictBaseCapturedEvent = ServerEvent<"serveradmintools_conflict_base_captured"> & {
  data: ConflictBaseCapturedData;
};

export function isConflictBaseCapturedEvent(
  event: ServerEvent
): event is ConflictBaseCapturedEvent {
  return event.name === "serveradmintools_conflict_base_captured";
}
