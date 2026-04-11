# Workspace

## Overview

Full-stack purchase management web application (Manajemen Pembelian). A personal tool for recording purchase transactions, managing purchase plans, tracking cash inflows, and using AI-assisted data entry — all in Indonesian.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Frontend**: React 19 + Vite + Tailwind CSS + shadcn/ui + wouter
- **AI**: OpenAI via Replit AI Integrations (gpt-4o-mini)

## Artifacts

- **`artifacts/api-server`** — Express API server (port 8080), routes under `/api/`
- **`artifacts/purchase-app`** — React + Vite frontend (root path `/`)

## Application Features

### Frontend pages (`artifacts/purchase-app`)
- **Dashboard** (`/`) — Summary stats (6 cards: purchases, plans, spend, planned, kas masuk, sisa kas) + recent activity feed. Shows negative cash warning.
- **Data Pembelian** (`/pembelian`) — Full CRUD for purchases with search, date-range filter, kategori filter, checkbox selection, selective export/print/delete, export to Excel/PDF, print with signature section
- **Rencana Pembelian** (`/rencana`) — Full CRUD for purchase plans with same features
- **Kas Masuk** (`/kas-masuk`) — Full CRUD for cash inflows with dynamic calculation of total_kas_masuk, total_pengeluaran, sisa_kas. Shows negative cash warning with red card.
- **Invoice / Memo** (`/invoice`) — Full CRUD for invoices with dynamic item rows, auto-calculated totals, single invoice PDF (with signature), list PDF/Excel export, bulk delete, search.
- **Asisten AI** (`/ai`) — Chat interface for natural language commands to manage data (create/read/delete/summary)

### Backend API (`artifacts/api-server`)
- `GET/POST /api/purchases` — list (with search, startDate/endDate, kategori filter) and create purchases
- `GET/PUT/DELETE /api/purchases/:id` — single purchase operations
- `POST /api/purchases/bulk-delete` — bulk delete
- `GET /api/purchases/export/excel|pdf` — exports with selective ids
- `GET/POST /api/purchase-plans` — same as purchases
- `GET/PUT/DELETE /api/purchase-plans/:id`, `/bulk-delete`, `/export/*`
- `GET/POST /api/cash-in` — list (with dynamic cash totals) and create
- `PUT/DELETE /api/cash-in/:id`, `/bulk-delete`, `/export/*`
- `GET /api/dashboard/summary` — Dashboard stats including cash totals
- `GET /api/dashboard/recent` — Recent 5 purchases and plans
- `GET/POST /api/invoices` — list (with search) and create invoices with items (transactional)
- `GET/PUT/DELETE /api/invoices/:id` — single invoice operations (transactional)
- `POST /api/invoices/bulk-delete` — bulk delete invoices (transactional)
- `GET /api/invoices/export/excel|pdf` — list exports
- `GET /api/invoices/:id/pdf` — single invoice PDF with signature
- `GET /api/financial-summary` — total_pengeluaran, total_kas_masuk, saldo_akhir, kekurangan_dana
- `POST /api/ai-command` — AI assistant endpoint (natural language to structured actions)
- `POST /api/backup` — Create PostgreSQL backup (pg_dump)
- `GET /api/backups` — List available backups
- `GET /api/backup/download/:filename` — Download specific backup

### Database schema (`lib/db/src/schema/`)
- `purchases` table: id, nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total, catatan, kategori, supplier, supplier_contact
- `purchase_plans` table: same fields as purchases
- `cash_in` table: id, nomor, tanggal, keterangan, jumlah_kas_masuk
- `invoices` table: id, nomor_invoice, tanggal, pelanggan, kontak_pelanggan, keterangan, catatan
- `invoice_items` table: id, invoice_id (FK), nama_item, jumlah, satuan, harga_satuan
- `harga_total` is auto-calculated server-side: `jumlah × harga_satuan`
- Cash totals dynamically calculated: `total_kas_masuk = SUM(cash_in.jumlah_kas_masuk)`, `sisa_kas = total_kas_masuk - SUM(purchases.harga_total)`

### Backup system
- Daily automated backup via `node-cron` (midnight)
- Manual backup via `POST /api/backup`
- Keeps last 7 backups, auto-cleanup on new backup
- Backups stored in `backups/` directory relative to api-server cwd

### AI Assistant
- Uses OpenAI gpt-4o-mini via Replit AI Integrations (no API key needed, billed to credits)
- Supports: create, read, delete, summary actions on all 3 tables
- Validates all AI-generated actions before execution
- Indonesian language responses

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Key Dependencies

- `pdfkit` + `xlsx` — server-side export (externalized in esbuild config)
- `node-cron` — daily backup scheduling (externalized in esbuild config)
- `openai` — AI assistant SDK (externalized in esbuild config)
- `@workspace/api-client-react` — generated React Query hooks
- `@workspace/api-zod` — generated Zod schemas
- `wouter` — client-side routing
- `react-hook-form` + `@hookform/resolvers/zod` — form management

### Enter key form navigation
- `useFormNavigation` hook (`src/hooks/use-form-navigation.ts`) enables Enter key navigation between form fields
- Applied to purchase form, kas masuk form, and invoice form
- Textarea: Enter = next field, Shift+Enter = newline
- Last field Enter triggers form submit
- Skips hidden/disabled fields automatically

### Financial summary in reports
- PDF exports for purchases and purchase-plans include financial summary footer (total pengeluaran, total kas masuk, saldo akhir, kekurangan dana)
- `/api/financial-summary` endpoint provides dynamic financial calculations
- Negative cash balance highlighted in red

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
