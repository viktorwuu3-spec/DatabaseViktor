import { pgTable, serial, text, real, integer } from "drizzle-orm/pg-core";
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

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  nama_kategori: text("nama_kategori").notNull().unique(),
});

export const insertCategorySchema = createInsertSchema(categoriesTable).omit({ id: true });
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category = typeof categoriesTable.$inferSelect;

export const suppliersTable = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  nama_supplier: text("nama_supplier").notNull(),
  kontak_supplier: text("kontak_supplier").notNull().default(""),
});

export const insertSupplierSchema = createInsertSchema(suppliersTable).omit({ id: true });
export type InsertSupplier = z.infer<typeof insertSupplierSchema>;
export type Supplier = typeof suppliersTable.$inferSelect;

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  nomor_invoice: text("nomor_invoice").notNull(),
  tanggal: text("tanggal").notNull(),
  pelanggan: text("pelanggan").notNull(),
  kontak_pelanggan: text("kontak_pelanggan").notNull().default(""),
  keterangan: text("keterangan").notNull().default(""),
  catatan: text("catatan").notNull().default(""),
});

export const insertInvoiceSchema = createInsertSchema(invoicesTable).omit({
  id: true,
});
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;

export const itemsTable = pgTable("items", {
  id: serial("id").primaryKey(),
  nama_item: text("nama_item").notNull(),
  satuan: text("satuan").notNull().default("pcs"),
});

export const insertItemSchema = createInsertSchema(itemsTable).omit({ id: true });
export type InsertItem = z.infer<typeof insertItemSchema>;
export type Item = typeof itemsTable.$inferSelect;

export const invoiceItemsTable = pgTable("invoice_items", {
  id: serial("id").primaryKey(),
  invoice_id: integer("invoice_id").notNull(),
  nama_item: text("nama_item").notNull(),
  jumlah: real("jumlah").notNull(),
  satuan: text("satuan").notNull().default("pcs"),
  harga_satuan: real("harga_satuan").notNull(),
});

export const insertInvoiceItemSchema = createInsertSchema(invoiceItemsTable).omit({
  id: true,
});
export type InsertInvoiceItem = z.infer<typeof insertInvoiceItemSchema>;
export type InvoiceItem = typeof invoiceItemsTable.$inferSelect;
