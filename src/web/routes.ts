import { Router, Request, Response } from "express";
import passport from "passport";
import { ensureAuthenticated } from "./auth";
import {
  getConfigSnapshot,
  listGuildIds,
  setApiToken,
  setDefaultChannel,
  setEventChannel,
} from "../db/channelStore";
import crypto from "crypto";
import { SERVER_EVENT_NAMES } from "../types/events";

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

router.get("/api/guilds", async (req: Request, res: Response) => {
  const isAuthed = (req as any).isAuthenticated && (req as any).isAuthenticated();
  if (!isAuthed) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const ids = await listGuildIds();
  const guilds = await Promise.all(
    ids.map(async (id) => {
      const config = await getConfigSnapshot(id);
      return { id, ...config };
    })
  );
  const user = (req as any).user?.profile;
  res.json({ guilds, user });
});

router.post("/web/guild/:id/token", ensureAuthenticated, async (req: Request, res: Response) => {
  const guildId = req.params.id as string;
  const token = crypto.randomBytes(32).toString("hex");
  try {
    await setApiToken(guildId, token);
    res.redirect("/web");
  } catch (err) {
    console.error(`[web] Failed to set API token for guild ${guildId}`, err);
    res.status(500).send("Failed to update API token. Please try again.");
  }
});

router.post("/web/guild/:id/default-channel", ensureAuthenticated, async (req: Request, res: Response) => {
  const guildId = req.params.id as string;
  const channelId = (req.body.channelId as string)?.trim();
  if (!channelId) {
    res.redirect("/web");
    return;
  }

  try {
    await setDefaultChannel(guildId, channelId);
    res.redirect("/web");
  } catch (err) {
    console.error(`[web] Failed to set default channel for guild ${guildId}`, err);
    res.status(500).send("Failed to update default channel. Please try again.");
  }
});

router.post("/web/guild/:id/event-channel", ensureAuthenticated, async (req: Request, res: Response) => {
  const guildId = req.params.id as string;
  const event = (req.body.event as string)?.trim();
  const channelId = (req.body.channelId as string)?.trim();
  if (!event || !channelId || !SERVER_EVENT_NAMES.includes(event as any)) {
    res.redirect("/web");
    return;
  }

  try {
    await setEventChannel(guildId, event as any, channelId);
    res.redirect("/web");
  } catch (err) {
    console.error(`[web] Failed to set event channel for guild ${guildId}, event ${event}`, err);
    res.status(500).send("Failed to update event channel. Please try again.");
  }
});

export default router;
