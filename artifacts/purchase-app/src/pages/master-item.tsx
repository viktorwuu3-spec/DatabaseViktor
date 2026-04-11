import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetItems,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  getGetItemsQueryKey,
} from "@workspace/api-client-react";
import type { Item } from "@workspace/api-client-react";
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
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MasterItem() {
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [namaItem, setNamaItem] = useState("");
  const [satuan, setSatuan] = useState("pcs");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: items, isLoading } = useGetItems(
    search ? { search } : undefined
  );
  const createMutation = useCreateItem();
  const updateMutation = useUpdateItem();
  const deleteMutation = useDeleteItem();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetItemsQueryKey() });
  };

  const openCreate = () => {
    setEditingItem(null);
    setNamaItem("");
    setSatuan("pcs");
    setIsFormOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditingItem(item);
    setNamaItem(item.nama_item);
    setSatuan(item.satuan);
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!namaItem.trim()) {
      toast({ variant: "destructive", title: "Nama item wajib diisi" });
      return;
    }

    const data = {
      nama_item: namaItem.trim(),
      satuan: satuan.trim() || "pcs",
    };

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data },
        {
          onSuccess: () => {
            setIsFormOpen(false);
            invalidate();
            toast({ title: "Item berhasil diupdate" });
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
            toast({ title: "Item berhasil ditambahkan" });
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
          toast({ title: "Item berhasil dihapus" });
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
              <Package className="w-8 h-8" />
              Master Item
            </h1>
            <p className="text-muted-foreground">Kelola data master item/barang.</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />Tambah Item
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari item..."
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
                    <TableHead>Nama Item</TableHead>
                    <TableHead className="w-[150px]">Satuan</TableHead>
                    <TableHead className="w-[100px] text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Memuat data...</TableCell>
                    </TableRow>
                  ) : !items || items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">Tidak ada item</TableCell>
                    </TableRow>
                  ) : (
                    items.map((item, idx) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-center">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{item.nama_item}</TableCell>
                        <TableCell className="text-muted-foreground">{item.satuan}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
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
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Tambah Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama Item</label>
              <Input
                value={namaItem}
                onChange={(e) => setNamaItem(e.target.value)}
                placeholder="Masukkan nama item"
                autoFocus
              />
            </div>
            <div>
              <label className="text-sm font-medium">Satuan</label>
              <Input
                value={satuan}
                onChange={(e) => setSatuan(e.target.value)}
                placeholder="pcs, rim, buah, kg..."
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
            <AlertDialogTitle>Hapus Item</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin? Data pembelian yang menggunakan item ini tidak akan terpengaruh.
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
