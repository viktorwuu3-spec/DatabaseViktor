import { format } from "date-fns";
import { id } from "date-fns/locale";

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "dd MMMM yyyy", { locale: id });
  } catch (e) {
    return dateStr;
  }
}
