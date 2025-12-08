import { ServerEvent } from "../types/events";
import { handlePlayerJoined } from "./playerJoined";
import { handlePlayerKilled } from "./playerKilled";
import { handleGameStarted } from "./gameStarted";
import { handleGameEnded } from "./gameEnded";
import { handleVoteStarted } from "./voteStarted";
import { handleVoteEnded } from "./voteEnded";
import { handleServerFpsLow } from "./serverFpsLow";
import { handleAdminAction } from "./adminAction";
import { handleConflictBaseCaptured } from "./conflictBaseCaptured";
import {
  isPlayerJoinedEvent,
  isPlayerKilledEvent,
  isGameStartedEvent,
  isGameEndedEvent,
  isVoteStartedEvent,
  isVoteEndedEvent,
  isServerFpsLowEvent,
  isAdminActionEvent,
  isConflictBaseCapturedEvent,
} from "../types/events";

export interface DispatchResult {
  handled: boolean;
  error?: unknown;
}

export async function dispatchEvent(event: ServerEvent, guildId: string): Promise<DispatchResult> {
  try {
    if (isPlayerJoinedEvent(event)) {
      await handlePlayerJoined(event, guildId);
      return { handled: true };
    }

    if (isPlayerKilledEvent(event)) {
      await handlePlayerKilled(event, guildId);
      return { handled: true };
    }

    if (isGameStartedEvent(event)) {
      await handleGameStarted(event, guildId);
      return { handled: true };
    }

    if (isGameEndedEvent(event)) {
      await handleGameEnded(event, guildId);
      return { handled: true };
    }

    if (isVoteStartedEvent(event)) {
      await handleVoteStarted(event, guildId);
      return { handled: true };
    }

    if (isVoteEndedEvent(event)) {
      await handleVoteEnded(event, guildId);
      return { handled: true };
    }

    if (isServerFpsLowEvent(event)) {
      await handleServerFpsLow(event, guildId);
      return { handled: true };
    }

    if (isAdminActionEvent(event)) {
      await handleAdminAction(event, guildId);
      return { handled: true };
    }

    if (isConflictBaseCapturedEvent(event)) {
      await handleConflictBaseCaptured(event, guildId);
      return { handled: true };
    }

    return { handled: false };
  } catch (error) {
    return { handled: true, error };
  }
}
