import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetPurchasePlans,
  getGetPurchasePlansQueryKey,
  useCreatePurchasePlan,
  useUpdatePurchasePlan,
  useDeletePurchasePlan,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
} from "@workspace/api-client-react";
import type { PurchasePlan, PurchasePlanInput } from "@workspace/api-client-react";
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
} from "lucide-react";
import { PurchaseForm } from "@/components/purchase-form";
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
  const [tanggal, setTanggal] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PurchasePlan | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams: { search?: string; tanggal?: string } = {};
  if (search) queryParams.search = search;
  if (tanggal) queryParams.tanggal = tanggal;

  const { data: plans, isLoading } = useGetPurchasePlans(queryParams);

  const createMutation = useCreatePurchasePlan();
  const updateMutation = useUpdatePurchasePlan();
  const deleteMutation = useDeletePurchasePlan();

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getGetPurchasePlansQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentActivityQueryKey() });
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
          invalidateQueries();
          toast({ title: "Berhasil dihapus" });
        },
        onError: () =>
          toast({ variant: "destructive", title: "Gagal menghapus" }),
      },
    );
  };

  const totalJumlah =
    plans?.reduce((sum, p) => sum + Number(p.jumlah), 0) || 0;
  const totalHarga =
    plans?.reduce((sum, p) => sum + Number(p.harga_total), 0) || 0;

  const buildExportUrl = (base: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (tanggal) params.set("tanggal", tanggal);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const handlePrint = () => {
    window.print();
  };

  const clearFilters = () => {
    setSearch("");
    setTanggal("");
  };

  const hasFilters = search || tanggal;

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
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              asChild
              data-testid="btn-export-excel"
            >
              <a
                href={buildExportUrl("/api/purchase-plans/export/excel")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileDown className="w-4 h-4 mr-2" />
                Excel
              </a>
            </Button>
            <Button variant="outline" asChild data-testid="btn-export-pdf">
              <a
                href={buildExportUrl("/api/purchase-plans/export/pdf")}
                target="_blank"
                rel="noopener noreferrer"
              >
                <FileText className="w-4 h-4 mr-2" />
                PDF
              </a>
            </Button>
            <Button
              variant="outline"
              onClick={handlePrint}
              data-testid="btn-print"
            >
              <Printer className="w-4 h-4 mr-2" />
              Cetak
            </Button>
            <Button
              onClick={() => {
                setEditingItem(null);
                setIsFormOpen(true);
              }}
              data-testid="btn-add"
            >
              <Plus className="w-4 h-4 mr-2" />
              Tambah
            </Button>
          </div>
        </div>

        <Card className="print:border-none print:shadow-none">
          <CardHeader className="print-hide">
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
              <div className="relative flex items-center gap-2">
                <CalendarDays className="absolute left-3 w-4 h-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="pl-9 w-44"
                  data-testid="input-tanggal"
                  title="Filter berdasarkan tanggal"
                />
              </div>
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
          </CardHeader>
          <CardContent className="print:p-0">
            <div className="print-only text-center mb-8">
              <h2 className="text-2xl font-bold">LAPORAN RENCANA PEMBELIAN</h2>
              <p className="text-gray-600">
                Tanggal Cetak: {formatDate(new Date().toISOString())}
              </p>
            </div>

            <div className="rounded-md border print:border-black">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 print:bg-gray-100">
                    <TableHead className="w-[100px] print:text-black">
                      Nomor
                    </TableHead>
                    <TableHead className="w-[120px] print:text-black">
                      Tanggal
                    </TableHead>
                    <TableHead className="print:text-black">
                      Keterangan
                    </TableHead>
                    <TableHead className="text-right print:text-black">
                      Jumlah
                    </TableHead>
                    <TableHead className="print:text-black">Satuan</TableHead>
                    <TableHead className="text-right print:text-black">
                      Harga Sat.
                    </TableHead>
                    <TableHead className="text-right print:text-black">
                      Total
                    </TableHead>
                    <TableHead className="w-[100px] text-center print-hide">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-10 text-muted-foreground"
                      >
                        Memuat data...
                      </TableCell>
                    </TableRow>
                  ) : plans?.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center py-10 text-muted-foreground"
                      >
                        Tidak ada data ditemukan
                      </TableCell>
                    </TableRow>
                  ) : (
                    plans?.map((p) => (
                      <TableRow
                        key={p.id}
                        className="print:border-b print:border-black"
                        data-testid={`row-plan-${p.id}`}
                      >
                        <TableCell className="font-medium print:text-black">
                          {p.nomor}
                        </TableCell>
                        <TableCell className="print:text-black">
                          {formatDate(p.tanggal)}
                        </TableCell>
                        <TableCell className="print:text-black">
                          {p.keterangan}
                          {p.catatan && (
                            <div className="text-xs text-muted-foreground print:text-gray-600 mt-1">
                              {p.catatan}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right print:text-black">
                          {p.jumlah}
                        </TableCell>
                        <TableCell className="print:text-black">
                          {p.satuan}
                        </TableCell>
                        <TableCell className="text-right print:text-black">
                          {formatCurrency(p.harga_satuan)}
                        </TableCell>
                        <TableCell className="text-right font-medium print:text-black">
                          {formatCurrency(p.harga_total)}
                        </TableCell>
                        <TableCell className="text-center print-hide">
                          <div className="flex justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingItem(p);
                                setIsFormOpen(true);
                              }}
                              data-testid={`btn-edit-${p.id}`}
                            >
                              <Pencil className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingId(p.id)}
                              data-testid={`btn-delete-${p.id}`}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {plans && plans.length > 0 && (
                  <tfoot>
                    <TableRow className="bg-muted/50 font-bold print:bg-gray-100 print:text-black">
                      <TableCell colSpan={3} className="text-right">
                        TOTAL
                      </TableCell>
                      <TableCell className="text-right">{totalJumlah}</TableCell>
                      <TableCell colSpan={2}></TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(totalHarga)}
                      </TableCell>
                      <TableCell className="print-hide"></TableCell>
                    </TableRow>
                  </tfoot>
                )}
              </Table>
            </div>

            <div className="print-only mt-16 flex justify-between px-10">
              <div className="text-center">
                <p className="mb-16">Diajukan oleh</p>
                <div className="w-48 border-b border-black"></div>
                <p className="mt-2 text-left">Tanggal: __________</p>
              </div>
              <div className="text-center">
                <p className="mb-16">Disetujui oleh</p>
                <div className="w-48 border-b border-black"></div>
                <p className="mt-2 text-left">Tanggal: __________</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <PurchaseForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        defaultValues={editingItem || undefined}
        onSubmit={editingItem ? handleUpdate : handleCreate}
        title={
          editingItem ? "Edit Rencana Pembelian" : "Tambah Rencana Pembelian"
        }
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
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
    </Layout>
  );
}
