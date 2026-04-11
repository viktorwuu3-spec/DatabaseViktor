import { pgTable, serial, text, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const purchasesTable = pgTable("purchases", {
  id: serial("id").primaryKey(),
  nomor: text("nomor").notNull(),
  tanggal: text("tanggal").notNull(),
  keterangan: text("keterangan").notNull(),
  jumlah: real("jumlah").notNull(),
  satuan: text("satuan").notNull(),
  harga_satuan: real("harga_satuan").notNull(),
  harga_total: real("harga_total").notNull(),
  catatan: text("catatan").notNull().default(""),
  kategori: text("kategori").notNull().default(""),
  supplier: text("supplier"),
  supplier_contact: text("supplier_contact"),
});

export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({
  id: true,
});
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;

export const cashInTable = pgTable("cash_in", {
  id: serial("id").primaryKey(),
  nomor: text("nomor").notNull(),
  tanggal: text("tanggal").notNull(),
  keterangan: text("keterangan").notNull().default(""),
  jumlah_kas_masuk: real("jumlah_kas_masuk").notNull(),
});

export const insertCashInSchema = createInsertSchema(cashInTable).omit({
  id: true,
});
export type InsertCashIn = z.infer<typeof insertCashInSchema>;
export type CashIn = typeof cashInTable.$inferSelect;

export const purchasePlansTable = pgTable("purchase_plans", {
  id: serial("id").primaryKey(),
  nomor: text("nomor").notNull(),
  tanggal: text("tanggal").notNull(),
  keterangan: text("keterangan").notNull(),
  jumlah: real("jumlah").notNull(),
  satuan: text("satuan").notNull(),
  harga_satuan: real("harga_satuan").notNull(),
  harga_total: real("harga_total").notNull(),
  catatan: text("catatan").notNull().default(""),
  kategori: text("kategori").notNull().default(""),
  supplier: text("supplier"),
  supplier_contact: text("supplier_contact"),
});

export const insertPurchasePlanSchema = createInsertSchema(
  purchasePlansTable,
).omit({ id: true });
export type InsertPurchasePlan = z.infer<typeof insertPurchasePlanSchema>;
export type PurchasePlan = typeof purchasePlansTable.$inferSelect;
