import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { useFormNavigation } from "@/hooks/use-form-navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Pencil, Trash2, FileSpreadsheet, FileText, Printer, X, CheckSquare,
} from "lucide-react";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import {
  useGetItems,
  useCreateItem,
  getGetItemsQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface InvoiceItem {
  id?: number;
  nama_item: string;
  jumlah: number;
  satuan: string;
  harga_satuan: number;
  total_item?: number;
}

interface InvoiceWithItems {
  id: number;
  nomor_invoice: string;
  tanggal: string;
  pelanggan: string;
  kontak_pelanggan: string;
  keterangan: string;
  catatan: string;
  items: InvoiceItem[];
  total_invoice: number;
}

function formatCurrency(val: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

const EMPTY_ITEM: InvoiceItem = { nama_item: "", jumlah: 1, satuan: "pcs", harga_satuan: 0 };

export default function InvoicePage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<InvoiceWithItems | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    nomor_invoice: "", tanggal: new Date().toISOString().split("T")[0],
    pelanggan: "", kontak_pelanggan: "", keterangan: "", catatan: "",
  });
  const [items, setItems] = useState<InvoiceItem[]>([{ ...EMPTY_ITEM }]);

  const { data: itemsData } = useGetItems();
  const createItemMutation = useCreateItem();

  const itemOptions = useMemo(
    () =>
      (itemsData || []).map((i) => ({
        value: i.nama_item,
        label: i.nama_item,
        sublabel: i.satuan,
      })),
    [itemsData]
  );

  const handleAddMasterItem = (name: string, idx: number) => {
    createItemMutation.mutate(
      { data: { nama_item: name, satuan: "pcs" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetItemsQueryKey() });
          updateItem(idx, "nama_item", name);
          updateItem(idx, "satuan", "pcs");
          toast({ title: `Item "${name}" ditambahkan ke master` });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Gagal menambahkan item" });
        },
      }
    );
  };

  const handleItemSelect = (idx: number, option: { value: string; sublabel?: string }) => {
    if (option.sublabel) {
      updateItem(idx, "satuan", option.sublabel);
    }
  };

  const { data: invoices, isLoading } = useQuery<InvoiceWithItems[]>({
    queryKey: ["invoices", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`${API_BASE}/invoices?${params}`);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const res = await fetch(`${API_BASE}/invoices`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); closeForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: unknown }) => {
      const res = await fetch(`${API_BASE}/invoices/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); closeForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/invoices/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["invoices"] }); setDeletingId(null); },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const res = await fetch(`${API_BASE}/invoices/bulk-delete`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setSelectedIds(new Set()); setBulkDeleteOpen(false);
    },
  });

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingInvoice(null);
    setFormData({ nomor_invoice: "", tanggal: new Date().toISOString().split("T")[0], pelanggan: "", kontak_pelanggan: "", keterangan: "", catatan: "" });
    setItems([{ ...EMPTY_ITEM }]);
  };

  const openCreate = () => {
    setEditingInvoice(null);
    setFormData({ nomor_invoice: "", tanggal: new Date().toISOString().split("T")[0], pelanggan: "", kontak_pelanggan: "", keterangan: "", catatan: "" });
    setItems([{ ...EMPTY_ITEM }]);
    setIsFormOpen(true);
  };

  const openEdit = (inv: InvoiceWithItems) => {
    setEditingInvoice(inv);
    setFormData({
      nomor_invoice: inv.nomor_invoice, tanggal: inv.tanggal,
      pelanggan: inv.pelanggan, kontak_pelanggan: inv.kontak_pelanggan,
      keterangan: inv.keterangan, catatan: inv.catatan,
    });
    setItems(inv.items.map((i) => ({
      nama_item: i.nama_item, jumlah: i.jumlah, satuan: i.satuan, harga_satuan: i.harga_satuan,
    })));
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.nomor_invoice || !formData.tanggal || !formData.pelanggan) return;
    const validItems = items.filter((i) => i.nama_item && i.jumlah > 0 && i.harga_satuan > 0);
    if (validItems.length === 0) return;

    const payload = { ...formData, items: validItems };
    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const addItem = () => setItems([...items, { ...EMPTY_ITEM }]);
  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== idx));
  };
  const updateItem = (idx: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...items];
    (updated[idx] as unknown as Record<string, unknown>)[field] = value;
    setItems(updated);
  };

  const grandTotal = items.reduce((sum, i) => sum + (i.jumlah || 0) * (i.harga_satuan || 0), 0);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };
  const allSelected = invoices && invoices.length > 0 && invoices.every((i) => selectedIds.has(i.id));
  const toggleSelectAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(invoices?.map((i) => i.id) ?? []));
  };

  const buildInvoiceExportUrl = (base: string) => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (selectedIds.size > 0) params.set("ids", Array.from(selectedIds).join(","));
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  const triggerSubmit = useCallback(() => { handleSubmit(); }, [formData, items, editingInvoice]);
  const { formRef, handleKeyDown } = useFormNavigation(triggerSubmit);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold">Invoice / Memo</h1>
            <p className="text-muted-foreground mt-1">Kelola invoice dan memo.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href={buildInvoiceExportUrl(`${API_BASE}/invoices/export/excel`)} target="_blank" rel="noopener noreferrer">
                <FileSpreadsheet className="w-4 h-4 mr-2" />Excel{selectedIds.size > 0 && ` (${selectedIds.size})`}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={buildInvoiceExportUrl(`${API_BASE}/invoices/export/pdf`)} target="_blank" rel="noopener noreferrer">
                <FileText className="w-4 h-4 mr-2" />PDF{selectedIds.size > 0 && ` (${selectedIds.size})`}
              </a>
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" />Cetak
            </Button>
            <Button onClick={openCreate}>
              <Plus className="w-4 h-4 mr-2" />Tambah
            </Button>
          </div>
        </div>

        <Card className="print:shadow-none print:border-0">
          <CardHeader className="print-hide">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 flex-1">
                <Input
                  placeholder="Cari nomor invoice..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                    <Trash2 className="w-4 h-4 mr-1" />{selectedIds.size} Hapus
                  </Button>
                  <CheckSquare className="w-4 h-4" />
                  <span>{selectedIds.size} dipilih</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="print:p-0">
            <div className="print-only text-center mb-6">
              <h2 className="print-title">DAFTAR INVOICE / MEMO</h2>
              <p className="print-subtitle">
                Total {invoices?.length ?? 0} invoice &bull; Dicetak: {formatDate(new Date().toISOString())}
              </p>
              {(search || selectedIds.size > 0) && (
                <div className="mt-2 text-xs italic text-gray-600">
                  {search && <p>Pencarian: &quot;{search}&quot;</p>}
                  {selectedIds.size > 0 && <p>Data terpilih: {selectedIds.size} item</p>}
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
                    <TableHead className="print-only w-[45px] text-center print:w-[5%]">No.</TableHead>
                    <TableHead className="print:w-[12%]">No. Invoice</TableHead>
                    <TableHead className="print:w-[12%]">Tanggal</TableHead>
                    <TableHead className="print:w-[18%]">Pelanggan</TableHead>
                    <TableHead className="print:w-[20%]">Keterangan</TableHead>
                    <TableHead className="text-center print:w-[8%]">Items</TableHead>
                    <TableHead className="text-right print:w-[15%]">Total</TableHead>
                    <TableHead className="w-[80px] text-center print-hide">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Memuat data...</TableCell></TableRow>
                  ) : invoices?.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center py-10 text-muted-foreground">Tidak ada invoice</TableCell></TableRow>
                  ) : (
                    invoices?.map((inv, idx) => (
                      <TableRow key={inv.id} className={selectedIds.has(inv.id) ? "bg-primary/5" : ""}>
                        <TableCell className="print-hide">
                          <input type="checkbox" checked={selectedIds.has(inv.id)} onChange={() => toggleSelect(inv.id)} className="h-4 w-4 rounded border-gray-300" />
                        </TableCell>
                        <TableCell className="print-only text-center">{idx + 1}</TableCell>
                        <TableCell className="font-medium text-xs">{inv.nomor_invoice}</TableCell>
                        <TableCell className="text-xs">{formatDate(inv.tanggal)}</TableCell>
                        <TableCell>{inv.pelanggan}</TableCell>
                        <TableCell className="text-xs">{inv.keterangan || "-"}</TableCell>
                        <TableCell className="text-center">{inv.items.length}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(inv.total_invoice)}</TableCell>
                        <TableCell className="print-hide">
                          <div className="flex gap-1 justify-center">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(inv)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => window.open(`${API_BASE}/invoices/${inv.id}/pdf`, "_blank")}>
                              <FileText className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeletingId(inv.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {invoices && invoices.length > 0 && (
              <div className="print-grand-total flex justify-end mt-2 border rounded-md overflow-hidden print:border-0 print:mt-1">
                <div className="bg-primary text-primary-foreground font-bold text-sm px-6 py-2 flex gap-8 items-center print:bg-[#1e40af] print:text-white print:w-full print:justify-end print:text-[9pt] print:py-1.5 print:px-3 print:rounded-none">
                  <span>GRAND TOTAL</span>
                  <span>{formatCurrency(invoices.reduce((sum, i) => sum + i.total_invoice, 0))}</span>
                </div>
              </div>
            )}

            <div className="print-only print-signature mt-16 flex justify-between px-10">
              <div className="text-center">
                <p className="mb-16">Dibuat oleh,</p>
                <div className="w-48 border-b border-black"></div>
                <p className="mt-1 text-xs">Nama / Tanda Tangan</p>
              </div>
              <div className="text-center">
                <p className="mb-16">Diketahui oleh,</p>
                <div className="w-48 border-b border-black"></div>
                <p className="mt-1 text-xs">Nama / Tanda Tangan</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={(v) => { if (!v) closeForm(); else setIsFormOpen(v); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingInvoice ? "Edit Invoice" : "Buat Invoice Baru"}</DialogTitle>
          </DialogHeader>
          <div ref={formRef} onKeyDown={handleKeyDown} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nomor Invoice *</label>
                <Input value={formData.nomor_invoice} onChange={(e) => setFormData({ ...formData, nomor_invoice: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Tanggal *</label>
                <Input type="date" value={formData.tanggal} onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Pelanggan *</label>
                <Input value={formData.pelanggan} onChange={(e) => setFormData({ ...formData, pelanggan: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium">Kontak Pelanggan</label>
                <Input value={formData.kontak_pelanggan} onChange={(e) => setFormData({ ...formData, kontak_pelanggan: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Keterangan</label>
              <Input value={formData.keterangan} onChange={(e) => setFormData({ ...formData, keterangan: e.target.value })} />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-medium">Item Invoice</label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                  <Plus className="w-3 h-3 mr-1" />Tambah Item
                </Button>
              </div>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="w-[40px]">No</TableHead>
                      <TableHead>Nama Item</TableHead>
                      <TableHead className="w-[80px]">Jumlah</TableHead>
                      <TableHead className="w-[80px]">Satuan</TableHead>
                      <TableHead className="w-[150px]">Harga Satuan</TableHead>
                      <TableHead className="w-[120px] text-right">Total</TableHead>
                      <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-center text-sm">{idx + 1}</TableCell>
                        <TableCell>
                          <SearchableCombobox
                            value={item.nama_item}
                            onChange={(val) => updateItem(idx, "nama_item", val)}
                            options={itemOptions}
                            placeholder="Pilih atau ketik item..."
                            allowCustom={true}
                            onAddNew={(name) => handleAddMasterItem(name, idx)}
                            onSelectOption={(opt) => handleItemSelect(idx, opt)}
                            addNewLabel="Tambah item baru"
                            className="min-w-[180px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            value={item.jumlah}
                            onChange={(e) => updateItem(idx, "jumlah", Number(e.target.value))}
                            className="h-8"
                            min={0}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            value={item.satuan}
                            onChange={(e) => updateItem(idx, "satuan", e.target.value)}
                            className="h-8"
                          />
                        </TableCell>
                        <TableCell>
                          <CurrencyInput
                            value={item.harga_satuan}
                            onChange={(val) => updateItem(idx, "harga_satuan", val)}
                            prefix=""
                            placeholder="0"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium text-sm">
                          {formatCurrency((item.jumlah || 0) * (item.harga_satuan || 0))}
                        </TableCell>
                        <TableCell>
                          {items.length > 1 && (
                            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)}>
                              <X className="w-3 h-3" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-2 p-3 bg-muted rounded-md flex justify-between items-center">
                <span className="font-medium">Total Invoice:</span>
                <span className="text-xl font-bold">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Catatan</label>
              <Textarea value={formData.catatan} onChange={(e) => setFormData({ ...formData, catatan: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeForm}>Batal</Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Invoice?</AlertDialogTitle>
            <AlertDialogDescription>Data yang dihapus tidak dapat dikembalikan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && deleteMutation.mutate(deletingId)}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus {selectedIds.size} Invoice?</AlertDialogTitle>
            <AlertDialogDescription>Semua invoice yang dipilih akan dihapus permanen.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => bulkDeleteMutation.mutate(Array.from(selectedIds))}>Hapus Semua</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
