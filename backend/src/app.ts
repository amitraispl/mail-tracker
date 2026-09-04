import "express-async-errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { authenticate } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { campaignsRouter, processRouter } from "./routes/campaigns.js";
import { trackRouter } from "./routes/track.js";

export function createApp() {
  const app = express();

  // Reverse-proxied in production — needed for req.ip / x-forwarded-for to
  // reflect the real client rather than the proxy.
  app.set("trust proxy", true);

  const frontendOrigin = process.env.FRONTEND_ORIGIN;
  app.use(
    cors({
      origin: frontendOrigin
        ? frontendOrigin.split(",").map((s) => s.trim())
        : true,
      credentials: true,
    }),
  );

  app.use(express.json({ limit: "2mb" })); // tracked HTML bodies can be sizeable
  app.use(cookieParser());

  app.get("/healthz", (_req, res) => res.json({ ok: true }));

  // Public — recipients' mail clients hit these unauthenticated.
  app.use("/api/track", trackRouter);
  app.use("/api/auth", authRouter);

  // Everything else requires a valid access token.
  app.use("/api/campaigns", authenticate, campaignsRouter);
  app.use("/api", authenticate, processRouter);

  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: "Not found." });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error." });
  });

  return app;
}
