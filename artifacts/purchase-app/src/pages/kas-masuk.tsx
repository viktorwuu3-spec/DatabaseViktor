import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Layout } from "@/components/layout";
import { useFormNavigation } from "@/hooks/use-form-navigation";
import {
  useGetCashInList,
  getGetCashInListQueryKey,
  useCreateCashIn,
  useUpdateCashIn,
  useDeleteCashIn,
  useBulkDeleteCashIn,
  getGetDashboardSummaryQueryKey,
} from "@workspace/api-client-react";
import type { CashIn, CashInInput } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCurrency, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
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
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
  AlertTriangle,
  Banknote,
  TrendingDown,
  Wallet,
} from "lucide-react";
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

const formSchema = z.object({
  nomor: z.string().min(1, "Nomor wajib diisi"),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  keterangan: z.string().optional(),
  jumlah_kas_masuk: z.coerce.number().min(1, "Jumlah harus lebih dari 0"),
});

type FormValues = z.infer<typeof formSchema>;

const EMPTY_DEFAULTS: FormValues = {
  nomor: "",
  tanggal: new Date().toISOString().split("T")[0],
  keterangan: "",
  jumlah_kas_masuk: 0,
};

export default function KasMasuk() {
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CashIn | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const queryParams: { search?: string; startDate?: string; endDate?: string } = {};
  if (search) queryParams.search = search;
  if (startDate) queryParams.startDate = startDate;
  if (endDate) queryParams.endDate = endDate;

  const { data: cashInData, isLoading } = useGetCashInList(queryParams);

  const createMutation = useCreateCashIn();
  const updateMutation = useUpdateCashIn();
  const deleteMutation = useDeleteCashIn();
  const bulkDeleteMutation = useBulkDeleteCashIn();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  useEffect(() => {
    if (isFormOpen) {
      if (editingItem) {
        form.reset({
          nomor: editingItem.nomor,
          tanggal: editingItem.tanggal,
          keterangan: editingItem.keterangan || "",
          jumlah_kas_masuk: editingItem.jumlah_kas_masuk,
        });
      } else {
        form.reset(EMPTY_DEFAULTS);
      }
    }
  }, [isFormOpen, editingItem, form]);

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: getGetCashInListQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const triggerSubmit = useCallback(() => {
    form.handleSubmit(handleSubmit)();
  }, [form, editingItem]);

  const { formRef: kasFormRef, handleKeyDown: kasHandleKeyDown } = useFormNavigation(triggerSubmit);

  const handleSubmit = (values: FormValues) => {
    const data: CashInInput = {
      nomor: values.nomor,
      tanggal: values.tanggal,
      keterangan: values.keterangan || "",
      jumlah_kas_masuk: values.jumlah_kas_masuk,
    };

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data },
        {
          onSuccess: () => {
            setIsFormOpen(false);
            setEditingItem(null);
            invalidateQueries();
            toast({ title: "Berhasil diupdate" });
          },
          onError: () => toast({ variant: "destructive", title: "Gagal mengupdate" }),
        },
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: () => {
            setIsFormOpen(false);
            invalidateQueries();
            toast({ title: "Berhasil disimpan" });
          },
          onError: () => toast({ variant: "destructive", title: "Gagal menyimpan" }),
        },
      );
    }
  };

  const handleDelete = () => {
    if (!deletingId) return;
    deleteMutation.mutate(
      { id: deletingId },
      {
        onSuccess: () => {
          setDeletingId(null);
          setSelectedIds((prev) => { const next = new Set(prev); next.delete(deletingId); return next; });
          invalidateQueries();
          toast({ title: "Berhasil dihapus" });
        },
        onError: () => toast({ variant: "destructive", title: "Gagal menghapus" }),
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
        onError: () => toast({ variant: "destructive", title: "Gagal menghapus data" }),
      },
    );
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const toggleSelectAll = () => {
    if (!cashInData?.items) return;
    if (selectedIds.size === cashInData.items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(cashInData.items.map((p) => p.id)));
  };

  const allSelected = cashInData?.items && cashInData.items.length > 0 && selectedIds.size === cashInData.items.length;

  const buildExportUrl = (base: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (selectedIds.size > 0) params.set("ids", Array.from(selectedIds).join(","));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const clearFilters = () => { setSearch(""); setStartDate(""); setEndDate(""); };
  const hasFilters = search || startDate || endDate;

  const sisaKasNegative = (cashInData?.sisa_kas ?? 0) < 0;

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print-hide">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Kas Masuk</h1>
            <p className="text-muted-foreground">Kelola data kas masuk dan pantau saldo kas Anda.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" asChild>
              <a href={buildExportUrl("/api/cash-in/export/excel")} target="_blank" rel="noopener noreferrer">
                <FileDown className="w-4 h-4 mr-1" />Excel{selectedIds.size > 0 && ` (${selectedIds.size})`}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={buildExportUrl("/api/cash-in/export/pdf")} target="_blank" rel="noopener noreferrer">
                <FileText className="w-4 h-4 mr-1" />PDF{selectedIds.size > 0 && ` (${selectedIds.size})`}
              </a>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" />Cetak
            </Button>
            {selectedIds.size > 0 && (
              <Button variant="destructive" onClick={() => setShowBulkDeleteConfirm(true)}>
                <Trash2 className="w-4 h-4 mr-1" />Hapus ({selectedIds.size})
              </Button>
            )}
            <Button onClick={() => { setEditingItem(null); setIsFormOpen(true); }}>
              <Plus className="w-4 h-4 mr-1" />Tambah
            </Button>
          </div>
        </div>

        {cashInData && (
          <div className="grid gap-4 md:grid-cols-3 print-hide">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium">Total Kas Masuk</span>
                <Banknote className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">{formatCurrency(cashInData.total_kas_masuk)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium">Total Pengeluaran</span>
                <TrendingDown className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{formatCurrency(cashInData.total_pengeluaran)}</div>
              </CardContent>
            </Card>
            <Card className={sisaKasNegative ? "border-red-300 bg-red-50" : ""}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <span className="text-sm font-medium">Sisa Kas</span>
                {sisaKasNegative ? <AlertTriangle className="h-4 w-4 text-red-500" /> : <Wallet className="h-4 w-4 text-blue-600" />}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${sisaKasNegative ? "text-red-600" : "text-blue-700"}`}>
                  {formatCurrency(cashInData.sisa_kas)}
                </div>
                {sisaKasNegative && <p className="text-xs text-red-500 mt-1">Kas minus! Tambahkan kas masuk.</p>}
              </CardContent>
            </Card>
          </div>
        )}

        <Card className="print:border-none print:shadow-none">
          <CardHeader className="print-hide">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="Cari keterangan atau nomor..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
                </div>
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4 text-muted-foreground" />
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" title="Dari tanggal" />
                  <span className="text-muted-foreground text-sm">s/d</span>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" title="Sampai tanggal" />
                </div>
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters}><X className="w-4 h-4 mr-1" />Reset</Button>
                )}
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <CheckSquare className="w-4 h-4" /><span>{selectedIds.size} data dipilih</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="print:p-0">
            <div className="print-only text-center mb-6">
              <h2 className="print-title">LAPORAN KAS MASUK</h2>
              <p className="print-subtitle">
                Total {cashInData?.items?.length ?? 0} transaksi &bull; Dicetak: {formatDate(new Date().toISOString())}
              </p>
              {(search || startDate || endDate || selectedIds.size > 0) && (
                <div className="mt-2 text-xs italic text-gray-600">
                  {startDate && endDate && <p>Periode: {formatDate(startDate)} s/d {formatDate(endDate)}</p>}
                  {startDate && !endDate && <p>Dari: {formatDate(startDate)}</p>}
                  {!startDate && endDate && <p>Sampai: {formatDate(endDate)}</p>}
                  {search && <p>Pencarian: &quot;{search}&quot;</p>}
                  {selectedIds.size > 0 && <p>Data terpilih: {selectedIds.size} item</p>}
                </div>
              )}
              {cashInData && (
                <div className="text-left mt-4 mb-4 text-xs">
                  <p>Total Kas Masuk: {formatCurrency(cashInData.total_kas_masuk)}</p>
                  <p>Total Pengeluaran: {formatCurrency(cashInData.total_pengeluaran)}</p>
                  <p className="font-bold">Sisa Kas: {formatCurrency(cashInData.sisa_kas)}</p>
                </div>
              )}
            </div>

            <div className="rounded-md border print:border-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[40px] print-hide">
                      <input type="checkbox" checked={!!allSelected} onChange={toggleSelectAll} className="h-4 w-4 rounded border-gray-300" />
                    </TableHead>
                    <TableHead className="print-only w-[45px] text-center print:w-[6%]">No.</TableHead>
                    <TableHead className="print:w-[15%]">Nomor</TableHead>
                    <TableHead className="print:w-[18%]">Tanggal</TableHead>
                    <TableHead className="print:w-[36%]">Keterangan</TableHead>
                    <TableHead className="text-right print:w-[25%]">Jumlah Kas Masuk</TableHead>
                    <TableHead className="w-[80px] text-center print-hide">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Memuat data...</TableCell></TableRow>
                  ) : cashInData?.items?.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">Tidak ada data ditemukan</TableCell></TableRow>
                  ) : (
                    cashInData?.items?.map((item, idx) => (
                      <TableRow key={item.id} className={selectedIds.has(item.id) ? "bg-primary/5" : ""}>
                        <TableCell className="print-hide">
                          <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelect(item.id)} className="h-4 w-4 rounded border-gray-300" />
                        </TableCell>
                        <TableCell className="print-only text-center">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{item.nomor}</TableCell>
                        <TableCell>{formatDate(item.tanggal)}</TableCell>
                        <TableCell>{item.keterangan || "-"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(item.jumlah_kas_masuk)}</TableCell>
                        <TableCell className="text-center print-hide">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => { setEditingItem(item); setIsFormOpen(true); }}>
                              <Pencil className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeletingId(item.id)}>
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

            {cashInData?.items && cashInData.items.length > 0 && (
              <div className="print-grand-total flex justify-end mt-2 border rounded-md overflow-hidden print:border-0 print:mt-1">
                <div className="bg-primary text-primary-foreground font-bold text-sm px-6 py-2 flex gap-8 items-center print:bg-[#1e40af] print:text-white print:w-full print:justify-end print:text-[9pt] print:py-1.5 print:px-3 print:rounded-none">
                  <span>TOTAL KAS MASUK</span>
                  <span>{formatCurrency(cashInData.total_kas_masuk)}</span>
                </div>
              </div>
            )}

            <div className="print-only print-signature mt-16 flex justify-between px-10">
              <div className="text-center">
                <p className="mb-16">Dibuat oleh,</p>
                <div className="w-48 border-b border-black"></div>
                <p className="mt-1 text-xs">Nama / Tanda Tangan</p>
                <p className="mt-2 text-left">Tanggal: _______________</p>
              </div>
              <div className="text-center">
                <p className="mb-16">Diketahui oleh,</p>
                <div className="w-48 border-b border-black"></div>
                <p className="mt-1 text-xs">Nama / Tanda Tangan</p>
                <p className="mt-2 text-left">Tanggal: _______________</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Kas Masuk" : "Tambah Kas Masuk"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div ref={kasFormRef} onKeyDown={kasHandleKeyDown}>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="nomor" render={({ field }) => (
                  <FormItem><FormLabel>Nomor</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="tanggal" render={({ field }) => (
                  <FormItem><FormLabel>Tanggal</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
              <FormField control={form.control} name="keterangan" render={({ field }) => (
                <FormItem><FormLabel>Keterangan (Opsional)</FormLabel><FormControl><Input {...field} placeholder="Keterangan kas masuk" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="jumlah_kas_masuk" render={({ field }) => (
                <FormItem><FormLabel>Jumlah Kas Masuk</FormLabel><FormControl><CurrencyInput value={Number(field.value) || 0} onChange={(val) => field.onChange(val)} /></FormControl><FormMessage /></FormItem>
              )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : "Simpan"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data</AlertDialogTitle>
            <AlertDialogDescription>Apakah Anda yakin ingin menghapus data ini? Tindakan ini tidak dapat dibatalkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={() => setShowBulkDeleteConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.size} Data</AlertDialogTitle>
            <AlertDialogDescription>Apakah Anda yakin ingin menghapus {selectedIds.size} data yang dipilih?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleteMutation.isPending ? "Menghapus..." : `Hapus ${selectedIds.size} Data`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
