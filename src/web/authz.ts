import { Request, Response, NextFunction } from "express";
import { listAuthorizedRoles } from "../db/authzStore";

// Enforce that user is logged in and is guild owner OR has an authorized role in that guild.
export async function ensureGuildAuthorized(req: Request, res: Response, next: NextFunction): Promise<void> {
  const isAuthed = (req as any).isAuthenticated && (req as any).isAuthenticated();
  if (!isAuthed) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const guildId = req.params.id;
  if (!guildId) {
    res.status(400).json({ error: "missing guild id" });
    return;
  }
  const profile = (req as any).user?.profile;
  if (!profile) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  const isOwner = profile.guilds?.some((g: any) => g.id === guildId && (g.owner || g.permissions === "Administrator"));
  if (isOwner) {
    next();
    return;
  }

  // NOTE: we cannot verify member roles with current OAuth scopes (identify+guilds only).
  // To avoid false negatives, only guild owners are allowed past this middleware until
  // we add a member-role aware flow (e.g., guilds.members.read or bot-side session).
  res.status(403).json({ error: "forbidden" });
}
