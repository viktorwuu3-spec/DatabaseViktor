import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { suppliersTable } from "@workspace/db";
import { eq, ilike } from "drizzle-orm";

const router: IRouter = Router();

router.get("/suppliers", async (req, res) => {
  try {
    const { search } = req.query;
    let query = db.select().from(suppliersTable).orderBy(suppliersTable.nama_supplier);
    if (search && typeof search === "string") {
      query = query.where(ilike(suppliersTable.nama_supplier, `%${search}%`)) as typeof query;
    }
    const data = await query;
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch suppliers");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/suppliers", async (req, res) => {
  try {
    const { nama_supplier, kontak_supplier } = req.body;
    if (!nama_supplier || typeof nama_supplier !== "string" || !nama_supplier.trim()) {
      res.status(400).json({ error: "nama_supplier wajib diisi" });
      return;
    }

    const [created] = await db
      .insert(suppliersTable)
      .values({
        nama_supplier: nama_supplier.trim(),
        kontak_supplier: typeof kontak_supplier === "string" ? kontak_supplier.trim() : "",
      })
      .returning();
    res.status(201).json(created);
  } catch (err) {
    req.log.error({ err }, "Failed to create supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/suppliers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const { nama_supplier, kontak_supplier } = req.body;
    if (!nama_supplier || typeof nama_supplier !== "string" || !nama_supplier.trim()) {
      res.status(400).json({ error: "nama_supplier wajib diisi" });
      return;
    }

    const [updated] = await db
      .update(suppliersTable)
      .set({
        nama_supplier: nama_supplier.trim(),
        kontak_supplier: typeof kontak_supplier === "string" ? kontak_supplier.trim() : "",
      })
      .where(eq(suppliersTable.id, id))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(updated);
  } catch (err) {
    req.log.error({ err }, "Failed to update supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/suppliers/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const [deleted] = await db
      .delete(suppliersTable)
      .where(eq(suppliersTable.id, id))
      .returning();

    if (!deleted) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ success: true, message: "Supplier berhasil dihapus" });
  } catch (err) {
    req.log.error({ err }, "Failed to delete supplier");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
