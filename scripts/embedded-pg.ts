import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import { mkdir } from "node:fs/promises";

const PORT = Number(process.env.EMBEDDED_PG_PORT || 54329);
const DIR = path.join(process.cwd(), "data", "pg");

async function main() {
  await mkdir(DIR, { recursive: true });
  const pg = new EmbeddedPostgres({
    databaseDir: DIR,
    user: "avenza",
    password: "avenza",
    port: PORT,
    persistent: true,
  });

  try {
    await pg.initialise();
  } catch {
    // already initialized
  }

  await pg.start();

  try {
    await pg.createDatabase("avenza");
  } catch {
    // exists
  }

  const url = `postgresql://avenza:avenza@127.0.0.1:${PORT}/avenza`;
  console.log(`Embedded Postgres ready on port ${PORT}`);
  console.log(`DATABASE_URL=${url}`);
  console.log("Leave this process running. Ctrl+C to stop.");

  process.on("SIGINT", async () => {
    await pg.stop();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await pg.stop();
    process.exit(0);
  });

  await new Promise(() => {});
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
