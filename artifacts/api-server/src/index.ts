import app from "./app";
import { logger } from "./lib/logger";
import cron from "node-cron";
import { createBackupFile } from "./routes/backup";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

cron.schedule("0 0 * * *", () => {
  logger.info("Running scheduled daily backup...");
  try {
    const filename = createBackupFile();
    logger.info({ filename }, "Daily backup completed");
  } catch (err) {
    logger.error({ err }, "Daily backup failed");
  }
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
