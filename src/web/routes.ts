import { Router, Request, Response } from "express";
import passport from "passport";
import { ensureAuthenticated } from "./auth";
import {
  getServerConfigSnapshot,
  listServersForGuild,
  createOrUpdateServer,
  linkServerToGuild,
  setServerDefaultChannel,
  setServerEventChannel,
} from "../db/serverStore";
import { listGuildIds } from "../db/channelStore";
import { SERVER_EVENT_NAMES } from "../types/events";
import { ensureGuildAuthorized } from "./authz";

const router = Router();

router.get("/", (_req, res) => res.redirect("/web"));

router.get("/auth/discord", passport.authenticate("discord"));

router.get(
  "/auth/discord/callback",
  passport.authenticate("discord", { failureRedirect: "/web" }),
  (_req, res) => {
    res.redirect("/web");
  }
);

router.get("/logout", (req, res, next) => {
  (req as any).logout((err: any) => {
    if (err) return next(err);
    res.redirect("/web");
  });
});

// Return guilds with their linked servers and mappings
router.get("/api/guilds", async (req: Request, res: Response) => {
  const isAuthed = (req as any).isAuthenticated && (req as any).isAuthenticated();
  if (!isAuthed) {
    return res.status(401).json({ error: "unauthorized" });
  }

  const profile = (req as any).user?.profile;
  const ownerGuildIds: Set<string> = new Set(
    (profile?.guilds || []).filter((g: any) => g.owner).map((g: any) => g.id)
  );

  if (!ownerGuildIds.size) {
    return res.status(403).json({ error: "forbidden" });
  }

  const ids = await listGuildIds();
  const owned = ids.filter((id) => ownerGuildIds.has(id));

  const guilds = await Promise.all(
    owned.map(async (id) => {
      const servers = await listServersForGuild(id);
      const enriched = await Promise.all(
        servers.map(async (s) => {
          const config = await getServerConfigSnapshot(s.id, id);
          return { id: s.id, label: s.label, token: s.token, ...config };
        })
      );
      return { id, servers: enriched };
    })
  );

  res.json({ guilds, user: profile });
});

// Create/link server from web (label + optional token)
router.post("/web/guild/:id/server", ensureGuildAuthorized, async (req: Request, res: Response) => {
  const guildId = req.params.id as string;
  const label = (req.body.label as string)?.trim();
  const token = (req.body.token as string)?.trim() || undefined;
  const newTokenRequested = !token;
  if (!label) {
    res.redirect("/web");
    return;
  }
  try {
    const server = await createOrUpdateServer(label, token);
    await linkServerToGuild(server.id, guildId);
    if (newTokenRequested) {
      res.status(200).send(`Server "${label}" created. Token (save it now): ${server.token}`);
    } else {
      res.redirect("/web");
    }
  } catch (err) {
    if ((err as Error).message === "TOKEN_REQUIRED") {
      res.status(400).send("Existing server label: token required to link.");
      return;
    }
    if ((err as Error).message === "TOKEN_INVALID") {
      res.status(400).send("Invalid token for this server label.");
      return;
    }
    console.error(`[web] Failed to upsert server ${label}`, err);
    res.status(500).send("Failed to update server. Please try again.");
  }
});

router.post(
  "/web/guild/:id/default-channel",
  ensureGuildAuthorized,
  async (req: Request, res: Response) => {
    const guildId = req.params.id as string;
    const label = (req.body.label as string)?.trim();
    const channelId = (req.body.channelId as string)?.trim();
    if (!label || !channelId) {
      res.redirect("/web");
      return;
    }
    try {
      const servers = await listServersForGuild(guildId);
      const server = servers.find((s) => s.label === label);
      if (!server) {
        res.status(400).send("Server not linked to this guild.");
        return;
      }
      await setServerDefaultChannel(server.id, guildId, channelId);
      res.redirect("/web");
    } catch (err) {
      console.error(`[web] Failed to set default channel for guild ${guildId}`, err);
      res.status(500).send("Failed to update default channel. Please try again.");
    }
  }
);

router.post(
  "/web/guild/:id/event-channel",
  ensureGuildAuthorized,
  async (req: Request, res: Response) => {
    const guildId = req.params.id as string;
    const label = (req.body.label as string)?.trim();
    const event = (req.body.event as string)?.trim();
    const channelId = (req.body.channelId as string)?.trim();
    if (!label || !event || !channelId || !SERVER_EVENT_NAMES.includes(event as any)) {
      res.redirect("/web");
      return;
    }

    try {
      const servers = await listServersForGuild(guildId);
      const server = servers.find((s) => s.label === label);
      if (!server) {
        res.status(400).send("Server not linked to this guild.");
        return;
      }
      await setServerEventChannel(server.id, guildId, event as any, channelId);
      res.redirect("/web");
    } catch (err) {
      console.error(
        `[web] Failed to set event channel for guild ${guildId}, event ${event}`,
        err
      );
      res.status(500).send("Failed to update event channel. Please try again.");
    }
  }
);

export default router;
