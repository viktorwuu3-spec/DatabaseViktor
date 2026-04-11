import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetSuppliers,
  useCreateSupplier,
  useUpdateSupplier,
  useDeleteSupplier,
  getGetSuppliersQueryKey,
} from "@workspace/api-client-react";
import type { Supplier } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MasterSupplier() {
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [namaSupplier, setNamaSupplier] = useState("");
  const [kontakSupplier, setKontakSupplier] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: suppliers, isLoading } = useGetSuppliers(
    search ? { search } : undefined
  );
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const deleteMutation = useDeleteSupplier();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
  };

  const openCreate = () => {
    setEditingItem(null);
    setNamaSupplier("");
    setKontakSupplier("");
    setIsFormOpen(true);
  };

  const openEdit = (item: Supplier) => {
    setEditingItem(item);
    setNamaSupplier(item.nama_supplier);
    setKontakSupplier(item.kontak_supplier || "");
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!namaSupplier.trim()) {
      toast({ variant: "destructive", title: "Nama supplier wajib diisi" });
      return;
    }

    const data = {
      nama_supplier: namaSupplier.trim(),
      kontak_supplier: kontakSupplier.trim(),
    };

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data },
        {
          onSuccess: () => {
            setIsFormOpen(false);
            invalidate();
            toast({ title: "Supplier berhasil diupdate" });
          },
          onError: () => toast({ variant: "destructive", title: "Gagal mengupdate" }),
        }
      );
    } else {
      createMutation.mutate(
        { data },
        {
          onSuccess: () => {
            setIsFormOpen(false);
            invalidate();
            toast({ title: "Supplier berhasil ditambahkan" });
          },
          onError: () => toast({ variant: "destructive", title: "Gagal menambahkan" }),
        }
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
          invalidate();
          toast({ title: "Supplier berhasil dihapus" });
        },
        onError: () => toast({ variant: "destructive", title: "Gagal menghapus" }),
      }
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Truck className="w-8 h-8" />
              Master Supplier
            </h1>
            <p className="text-muted-foreground">Kelola data master supplier.</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />Tambah Supplier
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-[60px]">No.</TableHead>
                    <TableHead>Nama Supplier</TableHead>
                    <TableHead>Kontak</TableHead>
                    <TableHead className="w-[100px] text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Memuat data...</TableCell>
                    </TableRow>
                  ) : !suppliers || suppliers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Tidak ada supplier</TableCell>
                    </TableRow>
                  ) : (
                    suppliers.map((sup, idx) => (
                      <TableRow key={sup.id}>
                        <TableCell className="text-center">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{sup.nama_supplier}</TableCell>
                        <TableCell className="text-muted-foreground">{sup.kontak_supplier || "-"}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(sup)}>
                              <Pencil className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeletingId(sup.id)}>
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Supplier" : "Tambah Supplier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama Supplier</label>
              <Input
                value={namaSupplier}
                onChange={(e) => setNamaSupplier(e.target.value)}
                placeholder="Masukkan nama supplier"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">Kontak Supplier (Opsional)</label>
              <Input
                value={kontakSupplier}
                onChange={(e) => setKontakSupplier(e.target.value)}
                placeholder="No. telp / email"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Batal</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {createMutation.isPending || updateMutation.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin? Data pembelian yang menggunakan supplier ini tidak akan terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? "Menghapus..." : "Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
