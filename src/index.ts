import express, { NextFunction, Request, Response } from "express";
import { EventBatchBody, SERVER_EVENT_NAMES, ServerEvent, ServerEventName } from "./types/events";
import { dispatchEvent } from "./handlers/dispatcher";
import { ENV } from "./config/env";
import { startDiscord } from "./discord/client";
import { getDb, initMigrations } from "./db/client";
import { findGuildIdByToken } from "./db/channelStore";
import { extractToken, normalizeBody } from "./utils/http";
import session from "express-session";
import passport from "passport";
import { configurePassport } from "./web/auth";
import webRoutes from "./web/routes";
import path from "path";

const app = express();
const PORT = ENV.PORT;
const KNOWN_EVENT_NAMES = new Set<ServerEventName>(SERVER_EVENT_NAMES);

// Accept JSON even if Arma sends application/x-www-form-urlencoded with a JSON body.
app.use(
  express.json({
    limit: "1mb",
    strict: false,
    type: "*/*",
  })
);
app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  })
);

// Sessions for web auth
app.use(
  session({
    secret: ENV.SESSION_SECRET || "change-me",
    resave: false,
    saveUninitialized: false,
  })
);
app.use(passport.initialize());
app.use(passport.session());

// Web UI routes (Discord OAuth)
app.use(webRoutes);

// Serve React build if present
const frontendDist = path.join(process.cwd(), "frontend", "dist");
app.use(express.static(frontendDist));
// Catch-all for /web and nested paths to serve React build
app.get(/^\/web(?:\/.*)?$/, (_req, res) => {
  res.sendFile(path.join(frontendDist, "index.html"));
});

app.post("/events", async (req: Request, res: Response) => {
  const parsedBody = normalizeBody(req.body);
  if (!parsedBody || !Array.isArray(parsedBody.events)) {
    res.status(400).json({ error: "Invalid payload: expected { token, events: [...] }" });
    return;
  }

  const token = extractToken(req, parsedBody);
  if (!token) {
    res.status(401).json({ error: "Missing token" });
    return;
  }

  const guildId = await findGuildIdByToken(token);
  if (!guildId) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const { events } = parsedBody;
  let recognized = 0;
  let handled = 0;
  const errors: string[] = [];

  for (const event of events) {
    const isKnown = KNOWN_EVENT_NAMES.has(event.name as ServerEventName);
    if (isKnown) {
      recognized += 1;
      logEvent(event as ServerEvent);
      const result = await dispatchEvent(event as ServerEvent, guildId);
      if (result.handled) {
        handled += 1;
      }
      if (result.error) {
        errors.push(String(result.error));
      }
    } else {
      logUnknownEvent(event);
    }
  }

  res.status(200).json({
    received: events.length,
    recognized,
    handled,
    errors: errors.length ? errors : undefined,
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Basic JSON parse error handler so bad bodies return 400 instead of 500.
app.use(
  (err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err.name === "SyntaxError") {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
    next(err);
  }
);

function logEvent(event: ServerEvent): void {
  console.info(
    `[event:${event.name}] title="${event.title}" ts=${event.timestamp} data=${JSON.stringify(event.data)}`
  );
}

function logUnknownEvent(event: unknown): void {
  console.warn(`[event:unknown] payload=${JSON.stringify(event)}`);
}

async function start(): Promise<void> {
  try {
    await initMigrations();
    const db = getDb();
    await db.query("SELECT 1");
    console.log("[startup][db] MySQL connection OK");
  } catch (err) {
    console.error("[startup][db] Connection failed:", err);
    process.exit(1);
  }

  configurePassport();

  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });

  // Start Discord client (non-blocking startup). If env vars missing, log warning.
  startDiscord().catch((err) => {
    console.warn("[startup] Discord client not started:", err instanceof Error ? err.message : err);
  });
}

start().catch((err) => {
  console.error("[startup] Fatal error:", err);
  process.exit(1);
});
