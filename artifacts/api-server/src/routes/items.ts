import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { itemsTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";

const router: IRouter = Router();

router.get("/items", async (req, res) => {
  try {
    const { search } = req.query;
    let query = db.select().from(itemsTable).orderBy(itemsTable.nama_item);
    if (search && typeof search === "string") {
      query = query.where(ilike(itemsTable.nama_item, `%${search}%`)) as typeof query;
    }
    const data = await query;
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch items");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/items", async (req, res) => {
  try {
    const { nama_item, satuan } = req.body;
    if (!nama_item || typeof nama_item !== "string" || !nama_item.trim()) {
      res.status(400).json({ error: "nama_item wajib diisi" });
      return;
    }

    const [created] = await db
      .insert(itemsTable)
      .values({
        nama_item: nama_item.trim(),
        satuan: typeof satuan === "string" && satuan.trim() ? satuan.trim() : "pcs",
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { nama_item, satuan } = req.body;
    if (!nama_item || typeof nama_item !== "string" || !nama_item.trim()) {
      res.status(400).json({ error: "nama_item wajib diisi" });
      return;
    }

    const [updated] = await db
      .update(itemsTable)
      .set({
        nama_item: nama_item.trim(),
        satuan: typeof satuan === "string" && satuan.trim() ? satuan.trim() : "pcs",
      })
      .where(eq(itemsTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update item");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/items/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [deleted] = await db
      .delete(itemsTable)
      .where(eq(itemsTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true, message: "Item berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete item");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
