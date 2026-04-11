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
- **Data Pembelian** (`/pembelian`) — Full CRUD for purchases with search, export to Excel/PDF, print with signature section (Dibuat/Diketahui)
- **Rencana Pembelian** (`/rencana`) — Full CRUD for purchase plans with same features, print shows Diajukan/Disetujui signature

### Backend API (`artifacts/api-server`)
- `GET/POST /api/purchases` — list (with search/tanggal filter) and create purchases
- `GET/PUT/DELETE /api/purchases/:id` — single purchase operations
- `GET /api/purchases/export/excel` — Excel export (xlsx)
- `GET /api/purchases/export/pdf` — PDF export (pdfkit)
- `GET/POST /api/purchase-plans` — list and create purchase plans
- `GET/PUT/DELETE /api/purchase-plans/:id` — single plan operations
- `GET /api/purchase-plans/export/excel` — Excel export
- `GET /api/purchase-plans/export/pdf` — PDF export
- `GET /api/dashboard/summary` — Dashboard stats
- `GET /api/dashboard/recent` — Recent 5 purchases and plans

### Database schema (`lib/db/src/schema/`)
- `purchases` table: id, nomor, tanggal, keterangan, jumlah, satuan, harga_satuan, harga_total, catatan
- `purchase_plans` table: same fields as purchases
- `harga_total` is auto-calculated server-side: `jumlah × harga_satuan`

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Key Dependencies

- `pdfkit` + `xlsx` — server-side export (externalized in esbuild config)
- `@workspace/api-client-react` — generated React Query hooks
- `@workspace/api-zod` — generated Zod schemas
- `wouter` — client-side routing
- `react-hook-form` + `@hookform/resolvers/zod` — form management

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
