import { useEffect, useCallback, useMemo } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import type { PurchaseInput } from "@workspace/api-client-react";
import {
  useGetCategories,
  useCreateCategory,
  useGetSuppliers,
  useCreateSupplier,
  useGetItems,
  useCreateItem,
  getGetCategoriesQueryKey,
  getGetSuppliersQueryKey,
  getGetItemsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useFormNavigation } from "@/hooks/use-form-navigation";
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
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import { CurrencyInput } from "@/components/ui/currency-input";
import { useToast } from "@/hooks/use-toast";

const formSchema = z.object({
  nomor: z.string().min(1, "Nomor wajib diisi"),
  tanggal: z.string().min(1, "Tanggal wajib diisi"),
  keterangan: z.string().min(1, "Keterangan wajib diisi"),
  jumlah: z.coerce.number().min(0.01, "Jumlah harus lebih dari 0"),
  satuan: z.string().min(1, "Satuan wajib diisi"),
  harga_satuan: z.coerce.number().min(0, "Harga tidak boleh negatif"),
  catatan: z.string().optional(),
  kategori: z.string().optional(),
  supplier: z.string().optional(),
  supplier_contact: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

interface PurchaseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<FormValues>;
  onSubmit: (data: PurchaseInput) => void;
  title: string;
  isSubmitting?: boolean;
}

const EMPTY_DEFAULTS: FormValues = {
  nomor: "",
  tanggal: new Date().toISOString().split("T")[0],
  keterangan: "",
  jumlah: 1,
  satuan: "pcs",
  harga_satuan: 0,
  catatan: "",
  kategori: "",
  supplier: "",
  supplier_contact: "",
};

export function PurchaseForm({
  open,
  onOpenChange,
  defaultValues,
  onSubmit,
  title,
  isSubmitting,
}: PurchaseFormProps) {
  const toFormValues = (dv?: PurchaseFormProps["defaultValues"]): FormValues => {
    if (!dv) return EMPTY_DEFAULTS;
    return {
      ...EMPTY_DEFAULTS,
      ...dv,
      supplier: dv.supplier ?? "",
      supplier_contact: dv.supplier_contact ?? "",
    };
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: toFormValues(defaultValues),
  });

  const jumlah = form.watch("jumlah");
  const hargaSatuan = form.watch("harga_satuan");
  const total = (Number(jumlah) || 0) * (Number(hargaSatuan) || 0);

  useEffect(() => {
    if (open) {
      form.reset(toFormValues(defaultValues));
    }
  }, [open, defaultValues, form]);

  const handleSubmit = (values: FormValues) => {
    onSubmit({
      ...values,
      catatan: values.catatan || "",
      kategori: values.kategori || "",
      supplier: values.supplier || null,
      supplier_contact: values.supplier_contact || null,
    });
  };

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: categoriesData } = useGetCategories();
  const { data: suppliersData } = useGetSuppliers();
  const { data: itemsData } = useGetItems();
  const createCategoryMutation = useCreateCategory();
  const createSupplierMutation = useCreateSupplier();
  const createItemMutation = useCreateItem();

  const categoryOptions = useMemo(
    () =>
      (categoriesData || []).map((c) => ({
        value: c.nama_kategori,
        label: c.nama_kategori,
      })),
    [categoriesData]
  );

  const supplierOptions = useMemo(
    () =>
      (suppliersData || []).map((s) => ({
        value: s.nama_supplier,
        label: s.nama_supplier,
        sublabel: s.kontak_supplier || undefined,
      })),
    [suppliersData]
  );

  const itemOptions = useMemo(
    () =>
      (itemsData || []).map((i) => ({
        value: i.nama_item,
        label: i.nama_item,
        sublabel: i.satuan,
      })),
    [itemsData]
  );

  const handleAddCategory = (name: string) => {
    createCategoryMutation.mutate(
      { data: { nama_kategori: name } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCategoriesQueryKey() });
          form.setValue("kategori", name);
          toast({ title: `Kategori "${name}" ditambahkan` });
        },
        onError: (err: any) => {
          toast({ variant: "destructive", title: err?.response?.data?.error || "Gagal menambahkan kategori" });
        },
      }
    );
  };

  const handleAddSupplier = (name: string) => {
    createSupplierMutation.mutate(
      { data: { nama_supplier: name, kontak_supplier: "" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSuppliersQueryKey() });
          form.setValue("supplier", name);
          toast({ title: `Supplier "${name}" ditambahkan` });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Gagal menambahkan supplier" });
        },
      }
    );
  };

  const handleAddItem = (name: string) => {
    createItemMutation.mutate(
      { data: { nama_item: name, satuan: "pcs" } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetItemsQueryKey() });
          form.setValue("keterangan", name);
          toast({ title: `Item "${name}" ditambahkan` });
        },
        onError: () => {
          toast({ variant: "destructive", title: "Gagal menambahkan item" });
        },
      }
    );
  };

  const handleItemSelect = (option: { value: string; sublabel?: string }) => {
    if (option.sublabel) {
      form.setValue("satuan", option.sublabel);
    }
  };

  const handleSupplierSelect = (option: { value: string; sublabel?: string }) => {
    form.setValue("supplier_contact", option.sublabel ?? "");
  };

  const triggerSubmit = useCallback(() => {
    form.handleSubmit(handleSubmit)();
  }, [form, handleSubmit]);

  const { formRef, handleKeyDown } = useFormNavigation(triggerSubmit);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <div ref={formRef} onKeyDown={handleKeyDown}>
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
                      <Input
                        type="date"
                        {...field}
                        data-testid="input-tanggal-form"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="kategori"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kategori</FormLabel>
                    <FormControl>
                      <SearchableCombobox
                        value={field.value || ""}
                        onChange={field.onChange}
                        options={categoryOptions}
                        placeholder="Pilih atau ketik kategori..."
                        allowCustom={true}
                        onAddNew={handleAddCategory}
                        addNewLabel="Tambah kategori"
                        data-testid="input-kategori"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="keterangan"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keterangan / Nama Barang</FormLabel>
                    <FormControl>
                      <SearchableCombobox
                        value={field.value || ""}
                        onChange={field.onChange}
                        options={itemOptions}
                        placeholder="Pilih atau ketik nama barang..."
                        allowCustom={true}
                        onAddNew={handleAddItem}
                        onSelectOption={handleItemSelect}
                        addNewLabel="Tambah item baru"
                        data-testid="input-keterangan"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="jumlah"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Jumlah</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        {...field}
                        data-testid="input-jumlah"
                      />
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
                      <CurrencyInput
                        value={Number(field.value) || 0}
                        onChange={(val) => field.onChange(val)}
                        data-testid="input-harga-satuan"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="p-4 bg-muted rounded-md flex justify-between items-center">
              <span className="font-medium">Total Harga:</span>
              <span className="text-xl font-bold">
                {new Intl.NumberFormat("id-ID", {
                  style: "currency",
                  currency: "IDR",
                }).format(total)}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Supplier (Opsional)</FormLabel>
                    <FormControl>
                      <SearchableCombobox
                        value={field.value || ""}
                        onChange={field.onChange}
                        options={supplierOptions}
                        placeholder="Pilih atau ketik supplier..."
                        allowCustom={true}
                        onAddNew={handleAddSupplier}
                        onSelectOption={handleSupplierSelect}
                        addNewLabel="Tambah supplier"
                        data-testid="input-supplier"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="supplier_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kontak Supplier (Opsional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="No. telp / email"
                        data-testid="input-supplier-contact"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                data-testid="button-submit-form"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
