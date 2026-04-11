import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { categoriesTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";

const router: IRouter = Router();

router.get("/categories", async (req, res) => {
  try {
    const { search } = req.query;
    let query = db.select().from(categoriesTable).orderBy(categoriesTable.nama_kategori);
    if (search && typeof search === "string") {
      query = query.where(ilike(categoriesTable.nama_kategori, `%${search}%`)) as typeof query;
    }
    const data = await query;
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch categories");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/categories", async (req, res) => {
  try {
    const { nama_kategori } = req.body;
    if (!nama_kategori || typeof nama_kategori !== "string" || !nama_kategori.trim()) {
      res.status(400).json({ error: "nama_kategori wajib diisi" });
      return;
    }

    const existing = await db
      .select()
      .from(categoriesTable)
      .where(ilike(categoriesTable.nama_kategori, nama_kategori.trim()));
    if (existing.length > 0) {
      res.status(409).json({ error: "Kategori sudah ada" });
      return;
    }

    const [created] = await db
      .insert(categoriesTable)
      .values({ nama_kategori: nama_kategori.trim() })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { nama_kategori } = req.body;
    if (!nama_kategori || typeof nama_kategori !== "string" || !nama_kategori.trim()) {
      res.status(400).json({ error: "nama_kategori wajib diisi" });
      return;
    }

    const existing = await db
      .select()
      .from(categoriesTable)
      .where(ilike(categoriesTable.nama_kategori, nama_kategori.trim()));
    if (existing.length > 0 && existing[0].id !== id) {
      res.status(409).json({ error: "Kategori sudah ada" });
      return;
    }

    const [updated] = await db
      .update(categoriesTable)
      .set({ nama_kategori: nama_kategori.trim() })
      .where(eq(categoriesTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update category");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [deleted] = await db
      .delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true, message: "Kategori berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete category");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
