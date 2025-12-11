import { EventBatchBody } from "../types/events";
import { Request } from "express";

export function normalizeBody(body: unknown): EventBatchBody | null {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as EventBatchBody;
    } catch {
      return null;
    }
  }

  if (body && typeof body === "object") {
    return body as EventBatchBody;
  }

  return null;
}

export function extractToken(req: Request, body: EventBatchBody): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice("Bearer ".length).trim() || null;
  }
  if (body.token && typeof body.token === "string") {
    return body.token;
  }
  return null;
}
