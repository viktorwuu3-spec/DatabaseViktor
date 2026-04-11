import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const formSchema = z.object({
  nomor: z.string().min(1, "Nomor wajib diisi"),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  keterangan: z.string().min(1, "Keterangan wajib diisi"),
  jumlah: z.coerce.number().min(0.01, "Jumlah harus lebih dari 0"),
  satuan: z.string().min(1, "Satuan wajib diisi"),
  harga_satuan: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  catatan: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface PurchaseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  onSubmit: (data: FormValues) => void;
  title: string;
  isSubmitting?: boolean;
}

export function PurchaseForm({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  title,
  isSubmitting
}: PurchaseFormProps) {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaultValues || {
      nomor: "",
      tanggal: new Date().toISOString().split('T')[0],
      keterangan: "",
      jumlah: 1,
      satuan: "pcs",
      harga_satuan: 0,
      catatan: "",
    },
  });

  const jumlah = form.watch("jumlah");
  const hargaSatuan = form.watch("harga_satuan");
  const total = (Number(jumlah) || 0) * (Number(hargaSatuan) || 0);

  useEffect(() => {
    if (open && defaultValues) {
      form.reset(defaultValues);
    } else if (open) {
      form.reset({
        nomor: "",
        tanggal: new Date().toISOString().split('T')[0],
        keterangan: "",
        jumlah: 1,
        satuan: "pcs",
        harga_satuan: 0,
        catatan: "",
      });
    }
  }, [open, defaultValues, form]);

  const handleSubmit = (values: FormValues) => {
    onSubmit({
      ...values,
      catatan: values.catatan || ""
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="nomor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nomor Dokumen</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-nomor" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="tanggal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tanggal</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} data-testid="input-tanggal" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="keterangan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Keterangan / Nama Barang</FormLabel>
                  <FormControl>
                    <Input {...field} data-testid="input-keterangan" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="jumlah"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jumlah</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} data-testid="input-jumlah" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="satuan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Satuan</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-satuan" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="harga_satuan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Harga Satuan</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-harga-satuan" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="p-4 bg-muted rounded-md flex justify-between items-center">
              <span className="font-medium">Total Harga:</span>
              <span className="text-xl font-bold">
                {new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(total)}
              </span>
            </div>

            <FormField
              control={form.control}
              name="catatan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Catatan (Opsional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={3} data-testid="input-catatan" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={isSubmitting} data-testid="button-submit-form">
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
