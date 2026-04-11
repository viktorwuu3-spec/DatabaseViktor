import { useState } from "react";
import { Layout } from "@/components/layout";
import {
  useGetCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  getGetCategoriesQueryKey,
} from "@workspace/api-client-react";
import type { Category } from "@workspace/api-client-react";
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
import { Plus, Pencil, Trash2, Search, Tags } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MasterKategori() {
  const [search, setSearch] = useState("");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Category | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [namaKategori, setNamaKategori] = useState("");

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categories, isLoading } = useGetCategories(
    search ? { search } : undefined
  );
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
  };

  const openCreate = () => {
    setEditingItem(null);
    setNamaKategori("");
    setIsFormOpen(true);
  };

  const openEdit = (item: Category) => {
    setEditingItem(item);
    setNamaKategori(item.nama_kategori);
    setIsFormOpen(true);
  };

  const handleSubmit = () => {
    if (!namaKategori.trim()) {
      toast({ variant: "destructive", title: "Nama kategori wajib diisi" });
      return;
    }

    if (editingItem) {
      updateMutation.mutate(
        { id: editingItem.id, data: { nama_kategori: namaKategori.trim() } },
        {
          onSuccess: () => {
            setIsFormOpen(false);
            invalidate();
            toast({ title: "Kategori berhasil diupdate" });
          },
          onError: (err: any) => {
            const msg = err?.response?.data?.error || "Gagal mengupdate";
            toast({ variant: "destructive", title: msg });
          },
        }
      );
    } else {
      createMutation.mutate(
        { data: { nama_kategori: namaKategori.trim() } },
        {
          onSuccess: () => {
            setIsFormOpen(false);
            invalidate();
            toast({ title: "Kategori berhasil ditambahkan" });
          },
          onError: (err: any) => {
            const msg = err?.response?.data?.error || "Gagal menambahkan";
            toast({ variant: "destructive", title: msg });
          },
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
          toast({ title: "Kategori berhasil dihapus" });
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
              <Tags className="w-8 h-8" />
              Master Kategori
            </h1>
            <p className="text-muted-foreground">Kelola data master kategori pembelian.</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="w-4 h-4 mr-1" />Tambah Kategori
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari kategori..."
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
                    <TableHead>Nama Kategori</TableHead>
                    <TableHead className="w-[100px] text-center">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Memuat data...</TableCell>
                    </TableRow>
                  ) : !categories || categories.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-10 text-muted-foreground">Tidak ada kategori</TableCell>
                    </TableRow>
                  ) : (
                    categories.map((cat, idx) => (
                      <TableRow key={cat.id}>
                        <TableCell className="text-center">{idx + 1}</TableCell>
                        <TableCell className="font-medium">{cat.nama_kategori}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                              <Pencil className="w-4 h-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeletingId(cat.id)}>
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
            <DialogTitle>{editingItem ? "Edit Kategori" : "Tambah Kategori"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Nama Kategori</label>
              <Input
                value={namaKategori}
                onChange={(e) => setNamaKategori(e.target.value)}
                placeholder="Masukkan nama kategori"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleSubmit(); } }}
                autoFocus
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
            <AlertDialogTitle>Hapus Kategori</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin? Data pembelian yang menggunakan kategori ini tidak akan terpengaruh.
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
