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
});

export const insertPurchaseSchema = createInsertSchema(purchasesTable).omit({
  id: true,
});
export type InsertPurchase = z.infer<typeof insertPurchaseSchema>;
export type Purchase = typeof purchasesTable.$inferSelect;

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
});

export const insertPurchasePlanSchema = createInsertSchema(
  purchasePlansTable,
).omit({ id: true });
export type InsertPurchasePlan = z.infer<typeof insertPurchasePlanSchema>;
export type PurchasePlan = typeof purchasePlansTable.$inferSelect;
