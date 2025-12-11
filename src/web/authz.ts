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
  const roles = await listAuthorizedRoles(guildId);
  if (!roles.length) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  const memberRoles: string[] = profile.guild_roles?.[guildId] ?? [];
  const ok = memberRoles.some((r) => roles.includes(r));
  if (!ok) {
    res.status(403).json({ error: "forbidden" });
    return;
  }
  next();
}
