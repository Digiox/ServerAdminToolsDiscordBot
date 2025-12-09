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

router.get("/api/guilds", (req: Request, res: Response) => {
  const isAuthed = (req as any).isAuthenticated && (req as any).isAuthenticated();
  if (!isAuthed) {
    return res.status(401).json({ error: "unauthorized" });
  }
  const guilds = listGuildIds().map((id) => {
    const config = getConfigSnapshot(id);
    return { id, ...config };
  });
  const user = (req as any).user?.profile;
  res.json({ guilds, user });
});

router.post("/web/guild/:id/token", ensureAuthenticated, (req: Request, res: Response) => {
  const guildId = req.params.id as string;
  const token = crypto.randomBytes(32).toString("hex");
  setApiToken(guildId, token);
  res.redirect("/web");
});

router.post("/web/guild/:id/default-channel", ensureAuthenticated, (req: Request, res: Response) => {
  const guildId = req.params.id as string;
  const channelId = (req.body.channelId as string)?.trim();
  if (channelId) {
    setDefaultChannel(guildId, channelId);
  }
  res.redirect("/web");
});

router.post("/web/guild/:id/event-channel", ensureAuthenticated, (req: Request, res: Response) => {
  const guildId = req.params.id as string;
  const event = (req.body.event as string)?.trim();
  const channelId = (req.body.channelId as string)?.trim();
  if (event && channelId && SERVER_EVENT_NAMES.includes(event as any)) {
    setEventChannel(guildId, event as any, channelId);
  }
  res.redirect("/web");
});

export default router;
