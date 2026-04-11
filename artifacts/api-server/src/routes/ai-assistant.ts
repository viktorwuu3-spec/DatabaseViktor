import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { cashInTable, purchasesTable, purchasePlansTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { SendAiCommandBody } from "@workspace/api-zod";
import OpenAI from "openai";

const router: IRouter = Router();

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey: process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
});

const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk aplikasi Manajemen Pembelian.
Kamu bisa membantu user melakukan operasi data melalui percakapan bahasa Indonesia.

TABEL YANG TERSEDIA:
1. cash_in (Kas Masuk) - kolom: nomor, tanggal (YYYY-MM-DD), keterangan, jumlah_kas_masuk
2. purchases (Pembelian) - kolom: nomor, tanggal (YYYY-MM-DD), keterangan, jumlah, satuan, harga_satuan, catatan, kategori, supplier, supplier_contact
3. purchase_plans (Rencana Pembelian) - kolom: sama dengan purchases

AKSI YANG DIDUKUNG:
- create: Tambah data baru
- read: Lihat/cari data
- delete: Hapus data berdasarkan ID
- summary: Ringkasan keuangan

ATURAN PENTING:
- Selalu jawab dalam bahasa Indonesia
- Jika user ingin menambah data, pastikan semua field wajib terisi
- Untuk tanggal, jika user bilang "hari ini" gunakan tanggal hari ini
- Jika perintah tidak jelas, tanyakan klarifikasi
- JANGAN pernah mengeksekusi perintah yang ambigu

Jika user meminta aksi data, jawab dalam format JSON yang VALID:
{
  "action": "create|read|delete|summary",
  "table": "cash_in|purchases|purchase_plans",
  "data": { ... },
  "id": number (untuk delete)
}

Jika user hanya bertanya atau mengobrol biasa, jawab secara natural tanpa JSON.
Tanggal hari ini: ${new Date().toISOString().split("T")[0]}`;

interface AiAction {
  action: string;
  table?: string;
  data?: Record<string, unknown>;
  id?: number;
}

function extractJsonFromText(text: string): AiAction | null {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.action && typeof parsed.action === "string") {
      return parsed as AiAction;
    }
    return null;
  } catch {
    return null;
  }
}

function validateAction(action: AiAction): string | null {
  const validActions = ["create", "read", "delete", "summary"];
  if (!validActions.includes(action.action)) {
    return `Aksi "${action.action}" tidak didukung`;
  }

  const validTables = ["cash_in", "purchases", "purchase_plans"];
  if (action.action !== "summary") {
    if (!action.table) {
      return "Tabel harus ditentukan untuk operasi ini";
    }
    if (!validTables.includes(action.table)) {
      return `Tabel "${action.table}" tidak dikenal`;
    }
  }

  if (action.action === "create" && !action.data) {
    return "Data tidak ditemukan untuk operasi create";
  }

  if (action.action === "delete") {
    if (!action.id || typeof action.id !== "number" || action.id <= 0) {
      return "ID harus berupa angka positif untuk operasi delete";
    }
  }

  return null;
}

async function executeAction(action: AiAction): Promise<string> {
  if (action.action === "summary") {
    const [kasResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(jumlah_kas_masuk), 0)::float` })
      .from(cashInTable);
    const [pengeluaranResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(harga_total), 0)::float` })
      .from(purchasesTable);
    const [rencanaPengeluaranResult] = await db
      .select({ total: sql<number>`COALESCE(SUM(harga_total), 0)::float` })
      .from(purchasePlansTable);

    const totalKas = kasResult?.total ?? 0;
    const totalBelanja = pengeluaranResult?.total ?? 0;
    const totalRencana = rencanaPengeluaranResult?.total ?? 0;
    const sisa = totalKas - totalBelanja;

    return `Ringkasan Keuangan:\n- Total Kas Masuk: Rp ${totalKas.toLocaleString("id-ID")}\n- Total Pengeluaran: Rp ${totalBelanja.toLocaleString("id-ID")}\n- Sisa Kas: Rp ${sisa.toLocaleString("id-ID")}\n- Total Rencana Pembelian: Rp ${totalRencana.toLocaleString("id-ID")}`;
  }

  if (action.action === "create" && action.data) {
    if (action.table === "cash_in") {
      const { nomor, tanggal, keterangan, jumlah_kas_masuk } = action.data as {
        nomor: string; tanggal: string; keterangan?: string; jumlah_kas_masuk: number;
      };

      if (!nomor || !tanggal || !jumlah_kas_masuk || jumlah_kas_masuk <= 0) {
        return "Data tidak valid. Pastikan nomor, tanggal, dan jumlah_kas_masuk (positif) diisi.";
      }

      const [created] = await db
        .insert(cashInTable)
        .values({ nomor, tanggal, keterangan: keterangan || "", jumlah_kas_masuk })
        .returning();

      return `Kas masuk berhasil ditambahkan! ID: ${created.id}, Nomor: ${created.nomor}, Jumlah: Rp ${created.jumlah_kas_masuk.toLocaleString("id-ID")}`;
    }

    if (action.table === "purchases") {
      const d = action.data as Record<string, unknown>;
      const nomor = String(d.nomor || "");
      const tanggal = String(d.tanggal || "");
      const keterangan = String(d.keterangan || "");
      const jumlah = Number(d.jumlah || 0);
      const satuan = String(d.satuan || "pcs");
      const harga_satuan = Number(d.harga_satuan || 0);

      if (!nomor || !tanggal || !keterangan || jumlah <= 0 || harga_satuan <= 0) {
        return "Data tidak valid. Pastikan nomor, tanggal, keterangan, jumlah, dan harga_satuan diisi.";
      }

      const harga_total = jumlah * harga_satuan;

      const [created] = await db
        .insert(purchasesTable)
        .values({
          nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total,
          catatan: String(d.catatan || ""),
          kategori: String(d.kategori || ""),
          supplier: d.supplier ? String(d.supplier) : null,
          supplier_contact: d.supplier_contact ? String(d.supplier_contact) : null,
        })
        .returning();

      return `Pembelian berhasil ditambahkan! ID: ${created.id}, ${keterangan}, Total: Rp ${harga_total.toLocaleString("id-ID")}`;
    }

    if (action.table === "purchase_plans") {
      const d = action.data as Record<string, unknown>;
      const nomor = String(d.nomor || "");
      const tanggal = String(d.tanggal || "");
      const keterangan = String(d.keterangan || "");
      const jumlah = Number(d.jumlah || 0);
      const satuan = String(d.satuan || "pcs");
      const harga_satuan = Number(d.harga_satuan || 0);

      if (!nomor || !tanggal || !keterangan || jumlah <= 0 || harga_satuan <= 0) {
        return "Data tidak valid. Pastikan nomor, tanggal, keterangan, jumlah, dan harga_satuan diisi.";
      }

      const harga_total = jumlah * harga_satuan;

      const [created] = await db
        .insert(purchasePlansTable)
        .values({
          nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total,
          catatan: String(d.catatan || ""),
          kategori: String(d.kategori || ""),
          supplier: d.supplier ? String(d.supplier) : null,
          supplier_contact: d.supplier_contact ? String(d.supplier_contact) : null,
        })
        .returning();

      return `Rencana pembelian berhasil ditambahkan! ID: ${created.id}, ${keterangan}, Total: Rp ${harga_total.toLocaleString("id-ID")}`;
    }
  }

  if (action.action === "delete" && action.id) {
    if (action.table === "cash_in") {
      const [deleted] = await db.delete(cashInTable).where(eq(cashInTable.id, action.id)).returning();
      return deleted ? `Kas masuk ID ${action.id} berhasil dihapus.` : `Data dengan ID ${action.id} tidak ditemukan.`;
    }
    if (action.table === "purchases") {
      const [deleted] = await db.delete(purchasesTable).where(eq(purchasesTable.id, action.id)).returning();
      return deleted ? `Pembelian ID ${action.id} berhasil dihapus.` : `Data dengan ID ${action.id} tidak ditemukan.`;
    }
    if (action.table === "purchase_plans") {
      const [deleted] = await db.delete(purchasePlansTable).where(eq(purchasePlansTable.id, action.id)).returning();
      return deleted ? `Rencana pembelian ID ${action.id} berhasil dihapus.` : `Data dengan ID ${action.id} tidak ditemukan.`;
    }
  }

  if (action.action === "read") {
    if (action.table === "cash_in") {
      const data = await db.select().from(cashInTable).orderBy(sql`id DESC`).limit(10);
      if (data.length === 0) return "Belum ada data kas masuk.";
      return "Data Kas Masuk (10 terakhir):\n" + data.map(r =>
        `- ${r.nomor} | ${r.tanggal} | ${r.keterangan} | Rp ${r.jumlah_kas_masuk.toLocaleString("id-ID")}`
      ).join("\n");
    }
    if (action.table === "purchases") {
      const data = await db.select().from(purchasesTable).orderBy(sql`id DESC`).limit(10);
      if (data.length === 0) return "Belum ada data pembelian.";
      return "Data Pembelian (10 terakhir):\n" + data.map(r =>
        `- ${r.nomor} | ${r.tanggal} | ${r.keterangan} | Rp ${r.harga_total.toLocaleString("id-ID")}`
      ).join("\n");
    }
    if (action.table === "purchase_plans") {
      const data = await db.select().from(purchasePlansTable).orderBy(sql`id DESC`).limit(10);
      if (data.length === 0) return "Belum ada data rencana pembelian.";
      return "Data Rencana Pembelian (10 terakhir):\n" + data.map(r =>
        `- ${r.nomor} | ${r.tanggal} | ${r.keterangan} | Rp ${r.harga_total.toLocaleString("id-ID")}`
      ).join("\n");
    }
  }

  return "Tidak dapat memproses perintah ini.";
}

router.post("/ai-command", async (req, res) => {
  try {
    const parsed = SendAiCommandBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input: message required" });
      return;
    }

    const { message } = parsed.data;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message },
      ],
      max_completion_tokens: 1000,
    });

    const aiResponse = completion.choices[0]?.message?.content || "Maaf, tidak ada respons dari AI.";

    const action = extractJsonFromText(aiResponse);

    if (action) {
      const validationError = validateAction(action);
      if (validationError) {
        res.json({
          reply: validationError,
          action_taken: false,
          action_summary: null,
        });
        return;
      }

      const result = await executeAction(action);
      const cleanReply = aiResponse.replace(/\{[\s\S]*\}/, "").trim();

      res.json({
        reply: cleanReply ? `${cleanReply}\n\n${result}` : result,
        action_taken: true,
        action_summary: `${action.action} pada ${action.table || "system"}`,
      });
    } else {
      res.json({
        reply: aiResponse,
        action_taken: false,
        action_summary: null,
      });
    }
  } catch (err) {
    req.log.error({ err }, "Failed to process AI command");
    res.status(500).json({
      reply: "Maaf, terjadi kesalahan saat memproses perintah Anda.",
      action_taken: false,
      action_summary: null,
    });
  }
});

export default router;
