import { Request, Response, NextFunction } from "express";

const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

type GuildAccess = { isOwner: boolean; canManage: boolean };

function parsePermissions(raw: unknown): bigint | null {
  if (raw === null || raw === undefined) return null;
  try {
    return BigInt(raw as any);
  } catch {
    return null;
  }
}

function hasManageGuildPermission(guild: any): boolean {
  const perms = parsePermissions(guild?.permissions_new ?? guild?.permissions);
  if (perms === null) return false;
  return (perms & (MANAGE_GUILD | ADMINISTRATOR)) !== 0n;
}

// Returns a map of guildId -> access info for guilds the user can manage.
export function buildGuildAccessMap(profile: any): Map<string, GuildAccess> {
  const access = new Map<string, GuildAccess>();
  for (const g of profile?.guilds ?? []) {
    if (!g?.id) continue;
    const isOwner = Boolean(g.owner);
    const canManage = isOwner || hasManageGuildPermission(g);
    if (canManage) {
      access.set(g.id, { isOwner, canManage });
    }
  }
  return access;
}

// Enforce that user is logged in and can manage the guild (owner or Manage Guild/Administrator perms).
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

  const access = buildGuildAccessMap(profile).get(guildId);
  if (access?.canManage) {
    next();
    return;
  }

  res.status(403).json({ error: "forbidden" });
}

