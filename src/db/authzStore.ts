import { getDb } from "./client";

const db = getDb();

export async function addAuthorizedRole(guildId: string, roleId: string): Promise<void> {
  await db.query(
    `INSERT INTO guild_authorized_roles (guild_id, role_id)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE role_id = VALUES(role_id)`,
    [guildId, roleId]
  );
}

export async function removeAuthorizedRole(guildId: string, roleId: string): Promise<void> {
  await db.query(`DELETE FROM guild_authorized_roles WHERE guild_id = ? AND role_id = ?`, [
    guildId,
    roleId,
  ]);
}

export async function listAuthorizedRoles(guildId: string): Promise<string[]> {
  const [rows] = await db.query(
    `SELECT role_id FROM guild_authorized_roles WHERE guild_id = ?`,
    [guildId]
  );
  return (rows as any[]).map((r) => r.role_id);
}
