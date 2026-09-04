/**
 * Creates (or resets the password for) the operator account. This is the
 * only way accounts get made — no self-registration, no in-app admin UI.
 *
 * Usage:
 *   npm run create-user -- --email you@example.com --password "a strong password"
 */
import "dotenv/config";
import { prisma } from "../db.js";
import { hashPassword } from "../lib/passwords.js";

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const direct = process.argv.find((a) => a.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return undefined;
}

async function main() {
  const email = arg("email")?.trim().toLowerCase();
  const password = arg("password");

  if (!email || !password) {
    console.error(
      'Usage: npm run create-user -- --email you@example.com --password "a strong password"',
    );
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash },
  });

  console.log(`User ready: ${user.email} (id: ${user.id})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
