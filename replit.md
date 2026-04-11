# Workspace

## Overview

Full-stack purchase management web application (Manajemen Pembelian). A personal tool for recording purchase transactions and managing purchase plans in Indonesian.

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

## Artifacts

- **`artifacts/api-server`** — Express API server (port 8080), routes under `/api/`
- **`artifacts/purchase-app`** — React + Vite frontend (root path `/`)

## Application Features

### Frontend pages (`artifacts/purchase-app`)
- **Dashboard** (`/`) — Summary stats (total purchases/plans, spend/planned amounts, monthly counts) + recent activity feed
- **Data Pembelian** (`/pembelian`) — Full CRUD for purchases with search, date-range filter, kategori filter, checkbox selection, selective export/print/delete, export to Excel/PDF, print with signature section (Dibuat/Diketahui)
- **Rencana Pembelian** (`/rencana`) — Full CRUD for purchase plans with same features, print shows Diajukan/Disetujui signature

### Backend API (`artifacts/api-server`)
- `GET/POST /api/purchases` — list (with search, startDate/endDate, kategori filter) and create purchases
- `GET/PUT/DELETE /api/purchases/:id` — single purchase operations
- `POST /api/purchases/bulk-delete` — bulk delete with `{ ids: number[] }`
- `GET /api/purchases/export/excel` — Excel export (xlsx), supports `ids` param for selective export
- `GET /api/purchases/export/pdf` — PDF export (pdfkit), supports `ids` param
- `GET/POST /api/purchase-plans` — list and create purchase plans (same filters as purchases)
- `GET/PUT/DELETE /api/purchase-plans/:id` — single plan operations
- `POST /api/purchase-plans/bulk-delete` — bulk delete
- `GET /api/purchase-plans/export/excel` — Excel export
- `GET /api/purchase-plans/export/pdf` — PDF export
- `GET /api/dashboard/summary` — Dashboard stats
- `GET /api/dashboard/recent` — Recent 5 purchases and plans
- `POST /api/backup` — Create PostgreSQL backup (pg_dump)
- `GET /api/backups` — List available backups
- `GET /api/backup/download/:filename` — Download specific backup

### Database schema (`lib/db/src/schema/`)
- `purchases` table: id, nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total, catatan, kategori, supplier, supplier_contact
- `purchase_plans` table: same fields as purchases
- `harga_total` is auto-calculated server-side: `jumlah × harga_satuan`
- `kategori` — not-null with default "" (predefined options: ATK, Konsumsi, Operasional, Lainnya)
- `supplier` — nullable, optional
- `supplier_contact` — nullable, optional

### Backup system
- Daily automated backup via `node-cron` (midnight)
- Manual backup via `POST /api/backup`
- Keeps last 7 backups, auto-cleanup on new backup
- Backups stored in `backups/` directory relative to api-server cwd

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Key Dependencies

- `pdfkit` + `xlsx` — server-side export (externalized in esbuild config)
- `node-cron` — daily backup scheduling (externalized in esbuild config)
- `@workspace/api-client-react` — generated React Query hooks
- `@workspace/api-zod` — generated Zod schemas
- `wouter` — client-side routing
- `react-hook-form` + `@hookform/resolvers/zod` — form management

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
