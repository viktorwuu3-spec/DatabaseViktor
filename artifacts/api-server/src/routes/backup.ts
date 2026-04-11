import { Router, type IRouter } from "express";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const router: IRouter = Router();
const BACKUP_DIR = path.resolve(process.cwd(), "backups");
const MAX_BACKUPS = 7;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function cleanOldBackups() {
  ensureBackupDir();
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith("backup-") && f.endsWith(".sql"))
    .sort()
    .reverse();

  if (files.length > MAX_BACKUPS) {
    const toDelete = files.slice(MAX_BACKUPS);
    for (const file of toDelete) {
      const filePath = path.join(BACKUP_DIR, file);
      fs.unlinkSync(filePath);
      console.log(`Deleted old backup: ${file}`);
    }
  }
}

function createBackupFile(): string {
  ensureBackupDir();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}-${pad(now.getMinutes())}`;
  const filename = `backup-${timestamp}.sql`;
  const filePath = path.join(BACKUP_DIR, filename);

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  execSync(`pg_dump "${dbUrl}" > "${filePath}"`, { stdio: "pipe" });
  console.log(`Backup created: ${filename}`);

  cleanOldBackups();
  return filename;
}

router.post("/backup", async (req, res) => {
  try {
    const filename = createBackupFile();
    res.json({ success: true, filename, message: "Backup berhasil dibuat" });
  } catch (err) {
    req.log.error({ err }, "Failed to create backup");
    res.status(500).json({ error: "Gagal membuat backup" });
  }
});

router.get("/backups", async (req, res) => {
  try {
    ensureBackupDir();
    const files = fs
      .readdirSync(BACKUP_DIR)
      .filter((f) => f.startsWith("backup-") && f.endsWith(".sql"))
      .sort()
      .reverse()
      .map((filename) => {
        const stat = fs.statSync(path.join(BACKUP_DIR, filename));
        return {
          filename,
          size: stat.size,
          created: stat.mtime.toISOString(),
        };
      });

    res.json(files);
  } catch (err) {
    req.log.error({ err }, "Failed to list backups");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/backup/download/:filename", async (req, res) => {
  try {
    const { filename } = req.params;

    if (!filename || !/^backup-[\d-]+\.sql$/.test(filename)) {
      res.status(400).json({ error: "Invalid filename" });
      return;
    }

    const filePath = path.join(BACKUP_DIR, filename);
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(BACKUP_DIR))) {
      res.status(403).json({ error: "Access denied" });
      return;
    }

    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }

    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    const stream = fs.createReadStream(resolvedPath);
    stream.pipe(res);
  } catch (err) {
    req.log.error({ err }, "Failed to download backup");
    res.status(500).json({ error: "Internal server error" });
  }
});

export { createBackupFile };
export default router;
