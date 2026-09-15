import "express-async-errors";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";

import { prisma } from "./db.js";
import { authenticate } from "./middleware/auth.js";
import { authRouter } from "./routes/auth.js";
import { campaignsRouter, processRouter } from "./routes/campaigns.js";
import { sendingRouter } from "./routes/sending.js";
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

  // Process liveness only — doesn't imply the DB is reachable. Every
  // tracking hit (open/click) needs a DB write to actually count, so a
  // "healthy" process with a dead DB connection would silently log nothing
  // while this endpoint kept reporting fine. `?db=1` adds a real DB
  // round-trip so that failure mode is distinguishable from the outside
  // instead of looking identical to "everything's fine."
  app.get("/healthz", async (req, res) => {
    if (req.query.db !== "1") {
      res.json({ ok: true });
      return;
    }
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ ok: true, db: true });
    } catch (error) {
      console.error("[healthz] db check failed", error);
      res.status(503).json({ ok: false, db: false });
    }
  });

  // Public — recipients' mail clients hit these unauthenticated.
  app.use("/api/track", trackRouter);
  app.use("/api/auth", authRouter);

  // Everything else requires a valid access token.
  app.use("/api/campaigns", authenticate, campaignsRouter);
  app.use("/api/campaigns", authenticate, sendingRouter);
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
