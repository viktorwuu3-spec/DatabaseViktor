import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetPurchasePlans,
  getGetPurchasePlansQueryKey,
  useCreatePurchasePlan,
  useUpdatePurchasePlan,
  useDeletePurchasePlan,
  useBulkDeletePurchasePlans,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
} from "@workspace/api-client-react";
import type {
  PurchasePlan,
  PurchasePlanInput,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Plus,
  Search,
  FileDown,
  FileText,
  Printer,
  Pencil,
  Trash2,
  CalendarDays,
  X,
  CheckSquare,
} from "lucide-react";
import { PurchaseForm, KATEGORI_OPTIONS } from "@/components/purchase-form";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PurchasePlans() {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [kategori, setKategori] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchasePlan | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams: {
    search?: string;
    startDate?: string;
    endDate?: string;
    kategori?: string;
  } = {};
  if (search) queryParams.search = search;
  if (startDate) queryParams.startDate = startDate;
  if (endDate) queryParams.endDate = endDate;
  if (kategori) queryParams.kategori = kategori;

  const { data: plans, isLoading } = useGetPurchasePlans(queryParams);

  const createMutation = useCreatePurchasePlan();
  const updateMutation = useUpdatePurchasePlan();
  const deleteMutation = useDeletePurchasePlan();
  const bulkDeleteMutation = useBulkDeletePurchasePlans();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({
      queryKey: getGetPurchasePlansQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getGetDashboardSummaryQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getGetRecentActivityQueryKey(),
    });
  };

  const handleCreate = (data: PurchasePlanInput) => {
    createMutation.mutate(
      { data },
      {
        onSuccess: () => {
          setIsFormOpen(false);
          invalidateQueries();
          toast({ title: "Berhasil disimpan" });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Gagal menyimpan" }),
      },
    );
  };

  const handleUpdate = (data: PurchasePlanInput) => {
    if (!editingItem) return;
    updateMutation.mutate(
      { id: editingItem.id, data },
      {
        onSuccess: () => {
          setIsFormOpen(false);
          setEditingItem(null);
          invalidateQueries();
          toast({ title: "Berhasil diupdate" });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Gagal mengupdate" }),
      },
    );
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(
      { id: deletingId },
      {
        onSuccess: () => {
          setDeletingId(null);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.delete(deletingId);
            return next;
          });
          invalidateQueries();
          toast({ title: "Berhasil dihapus" });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Gagal menghapus" }),
      },
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    bulkDeleteMutation.mutate(
      { data: { ids: Array.from(selectedIds) } },
      {
        onSuccess: () => {
          setShowBulkDeleteConfirm(false);
          setSelectedIds(new Set());
          invalidateQueries();
          toast({ title: `${selectedIds.size} data berhasil dihapus` });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Gagal menghapus data" }),
      },
    );
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!plans) return;
    if (selectedIds.size === plans.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(plans.map((p) => p.id)));
    }
  };

  const allSelected =
    plans && plans.length > 0 && selectedIds.size === plans.length;

  const totalHarga =
    plans?.reduce((sum, p) => sum + Number(p.harga_total), 0) || 0;

  const buildExportUrl = (base: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (kategori) params.set("kategori", kategori);
    if (selectedIds.size > 0) {
      params.set("ids", Array.from(selectedIds).join(","));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setSearch("");
    setStartDate("");
    setEndDate("");
    setKategori("");
  };

  const hasFilters = search || startDate || endDate || kategori;


  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print-hide">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Rencana Pembelian
            </h1>
            <p className="text-muted-foreground">
              Kelola rencana transaksi pengeluaran masa depan.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" asChild data-testid="btn-export-excel">
              <a
                href={buildExportUrl("/api/purchase-plans/export/excel")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileDown className="w-4 h-4 mr-1" />
                Excel{selectedIds.size > 0 && ` (${selectedIds.size})`}
              </a>
            </Button>
            <Button variant="outline" asChild data-testid="btn-export-pdf">
              <a
                href={buildExportUrl("/api/purchase-plans/export/pdf")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="w-4 h-4 mr-1" />
                PDF{selectedIds.size > 0 && ` (${selectedIds.size})`}
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              data-testid="btn-print"
            >
              <Printer className="w-4 h-4 mr-1" />
              Cetak{selectedIds.size > 0 && ` (${selectedIds.size})`}
            </Button>
            {selectedIds.size > 0 && (
              <Button
                variant="destructive"
                onClick={() => setShowBulkDeleteConfirm(true)}
                data-testid="btn-bulk-delete"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Hapus ({selectedIds.size})
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingItem(null);
                setIsFormOpen(true);
              }}
              data-testid="btn-add"
            >
              <Plus className="w-4 h-4 mr-1" />
              Tambah
            </Button>
          </div>
        </div>

        <Card className="print:border-none print:shadow-none">
          <CardHeader className="print-hide">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Cari keterangan atau nomor..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9"
                    data-testid="input-search"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-40"
                    data-testid="input-start-date"
                    title="Dari tanggal"
                  />
                  <span className="text-muted-foreground text-sm">s/d</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-40"
                    data-testid="input-end-date"
                    title="Sampai tanggal"
                  />
                </div>
                <select
                  value={kategori}
                  onChange={(e) => setKategori(e.target.value)}
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  data-testid="filter-kategori"
                >
                  <option value="">Semua Kategori</option>
                  {KATEGORI_OPTIONS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                {hasFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="btn-clear-filter"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckSquare className="w-4 h-4" />
                  <span>{selectedIds.size} data dipilih</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="print:p-0">
            <div className="print-only text-center mb-6">
              <h2 className="print-title">LAPORAN RENCANA PEMBELIAN</h2>
              <p className="print-subtitle">
                Total {plans?.length ?? 0} rencana &bull; Dicetak: {formatDate(new Date().toISOString())}
              </p>
            </div>

            <div className="rounded-md border print:border-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40px] print-hide">
                      <input
                        type="checkbox"
                        checked={!!allSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300"
                        data-testid="checkbox-select-all"
                      />
                    </TableHead>
                    <TableHead className="print-only w-[30px]">No</TableHead>
                    <TableHead className="w-[80px]">Nomor</TableHead>
                    <TableHead className="w-[100px]">Tanggal</TableHead>
                    <TableHead className="w-[80px]">Kategori</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead className="text-right">Jml</TableHead>
                    <TableHead>Satuan</TableHead>
                    <TableHead className="text-right">Harga Sat.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead className="w-[80px] text-center print-hide">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                        Memuat data...
                      </TableCell>
                    </TableRow>
                  ) : plans?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-10 text-muted-foreground">
                        Tidak ada data ditemukan
                      </TableCell>
                    </TableRow>
                  ) : (
                    plans?.map((p, idx) => (
                      <TableRow
                        key={p.id}
                        className={selectedIds.has(p.id) ? "bg-primary/5" : ""}
                        data-testid={`row-plan-${p.id}`}
                      >
                        <TableCell className="print-hide">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(p.id)}
                            onChange={() => toggleSelect(p.id)}
                            className="h-4 w-4 rounded border-gray-300"
                            data-testid={`checkbox-${p.id}`}
                          />
                        </TableCell>
                        <TableCell className="print-only text-center">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-xs">{p.nomor}</TableCell>
                        <TableCell className="text-xs">{formatDate(p.tanggal)}</TableCell>
                        <TableCell className="text-xs">{p.kategori || "-"}</TableCell>
                        <TableCell>
                          {p.keterangan}
                          {p.catatan && (
                            <div className="text-xs text-muted-foreground mt-1">{p.catatan}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right">{p.jumlah}</TableCell>
                        <TableCell>{p.satuan}</TableCell>
                        <TableCell className="text-right">{formatCurrency(p.harga_satuan)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(p.harga_total)}</TableCell>
                        <TableCell className="text-xs">
                          <div>{p.supplier || "-"}</div>
                          {p.supplier_contact && (
                            <div className="text-xs text-muted-foreground">{p.supplier_contact}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-center print-hide">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingItem(p); setIsFormOpen(true); }} data-testid={`btn-edit-${p.id}`}>
                              <Pencil className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeletingId(p.id)} data-testid={`btn-delete-${p.id}`}>
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {plans && plans.length > 0 && (
              <div className="flex justify-end mt-2 border rounded-md overflow-hidden">
                <div className="bg-primary text-primary-foreground font-bold text-sm px-6 py-2 flex gap-8 items-center">
                  <span>GRAND TOTAL</span>
                  <span>{formatCurrency(totalHarga)}</span>
                </div>
              </div>
            )}

            <div className="print-only print-signature mt-16 flex justify-between px-10">
              <div className="text-center">
                <p className="mb-16">Diajukan oleh,</p>
                <div className="w-48 border-b border-black"></div>
                <p className="mt-1 text-xs">Nama / Tanda Tangan</p>
                <p className="mt-2 text-left">Tanggal: _______________</p>
              </div>
              <div className="text-center">
                <p className="mb-16">Disetujui oleh,</p>
                <div className="w-48 border-b border-black"></div>
                <p className="mt-1 text-xs">Nama / Tanda Tangan</p>
                <p className="mt-2 text-left">Tanggal: _______________</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PurchaseForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        defaultValues={editingItem ? { ...editingItem, supplier: editingItem.supplier ?? undefined, supplier_contact: editingItem.supplier_contact ?? undefined } : undefined}
        onSubmit={editingItem ? handleUpdate : handleCreate}
        title={
          editingItem ? "Edit Rencana Pembelian" : "Tambah Rencana Pembelian"
        }
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog
        open={!!deletingId}
        onOpenChange={() => setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak
              dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={showBulkDeleteConfirm}
        onOpenChange={() => setShowBulkDeleteConfirm(false)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.size} Data</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus {selectedIds.size} data yang
              dipilih? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleteMutation.isPending
                ? "Menghapus..."
                : `Hapus ${selectedIds.size} Data`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
