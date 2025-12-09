import passport from "passport";
import { Strategy as DiscordStrategy, Profile, StrategyOptions } from "passport-discord";
import { ENV } from "../config/env";

const scopes = ["identify", "guilds"];

export function configurePassport(): void {
  passport.serializeUser((user: any, done: (err: any, id?: unknown) => void) => done(null, user));
  passport.deserializeUser((obj: any, done: (err: any, user?: unknown) => void) => done(null, obj));

  passport.use(
    new DiscordStrategy(
      {
        clientID: ENV.DISCORD_APP_ID,
        clientSecret: ENV.DISCORD_CLIENT_SECRET || ENV.DISCORD_TOKEN,
        callbackURL: ENV.OAUTH_CALLBACK_URL || "http://localhost:3000/auth/discord/callback",
        scope: scopes,
        passReqToCallback: true,
      } as any,
      ((
        _req: any,
        accessToken: string,
        _params: any,
        refreshToken: string,
        profile: Profile,
        done: (err: any, user?: unknown) => void
      ) => {
        return done(null, { profile, accessToken, refreshToken });
      }) as any
    )
  );
}

export function ensureAuthenticated(req: any, res: any, next: any): void {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect("/auth/discord");
}
