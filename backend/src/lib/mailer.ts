import nodemailer, { type Transporter } from "nodemailer";

/** One pooled connection, built once at boot from env — see .env.example.
 *  Shared by every user's campaign send; there is no per-user SMTP config. */
let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (transport) return transport;

  console.log("Creating transporter");

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const username = process.env.SMTP_USERNAME;
  const password = process.env.SMTP_PASSWORD;
  const useTls = process.env.SMTP_USE_TLS !== "false";

  if (!host || !username || !password) {
    throw new Error(
      "SMTP is not configured — set SMTP_HOST, SMTP_USERNAME and SMTP_PASSWORD.",
    );
  }

  transport = nodemailer.createTransport({
    host,
    port,
    secure: !useTls && port === 465, // STARTTLS (587) vs implicit TLS (465)
    requireTLS: useTls,
    auth: { user: username, pass: password },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    // Nodemailer's defaults are multi-minute (up to 10min socketTimeout) — a
    // slow/blocked path to the SMTP host would hang a send that long, making
    // every recipient sit in "sending" while the frontend correctly keeps
    // polling. Fail fast instead so a bad send shows up as `failed` in
    // seconds, not minutes.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  return transport;
}

function fromHeader(): string {
  const name = process.env.EMAIL_FROM_NAME;
  const address = process.env.EMAIL_FROM_ADDRESS;
  if (!address) {
    throw new Error("EMAIL_FROM_ADDRESS is not set.");
  }
  return name ? `${name} <${address}>` : address;
}

/** Sends one HTML email. Throws on failure — callers decide whether that's
 *  fatal (a diagnostic test-send) or per-row (a campaign send loop).
 *
 * TEMP DIAGNOSTIC LOGGING — pinpointing a prod hang (Vercel rewrite timing
 * out waiting on Render, no response at all within 120s). Remove once the
 * root cause is confirmed; not meant to stay long-term. */
export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const transporter = getTransport();

  console.log("Connecting SMTP");
  await transporter.verify();
  console.log("SMTP connected");

  console.log("Sending mail");
  await transporter.sendMail({
    from: fromHeader(),
    to,
    subject,
    html,
  });
  console.log("Mail sent");
}
