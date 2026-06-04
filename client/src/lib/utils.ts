import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── Status helpers ───────────────────────────────────────────────────────────

export const CONTRACT_STATUSES = {
  draft: { label: "Черновик", color: "bg-slate-100 text-slate-600" },
  active: { label: "Активен", color: "bg-emerald-100 text-emerald-700" },
  suspended: { label: "Приостановлен", color: "bg-amber-100 text-amber-700" },
  completed: { label: "Завершён", color: "bg-blue-100 text-blue-700" },
  terminated: { label: "Расторгнут", color: "bg-red-100 text-red-700" },
} as const;

export const SPEC_STATUSES = {
  draft: { label: "Черновик", color: "bg-slate-100 text-slate-600" },
  active: { label: "Активна", color: "bg-emerald-100 text-emerald-700" },
  completed: { label: "Выполнена", color: "bg-blue-100 text-blue-700" },
  cancelled: { label: "Отменена", color: "bg-red-100 text-red-700" },
} as const;

export const WAYBILL_STATUSES = {
  draft: { label: "Черновик", color: "bg-slate-100 text-slate-600" },
  in_transit: { label: "В пути", color: "bg-amber-100 text-amber-700" },
  delivered: { label: "Доставлено", color: "bg-emerald-100 text-emerald-700" },
  cancelled: { label: "Отменена", color: "bg-red-100 text-red-700" },
} as const;

export const COUNTERPARTY_TYPES = {
  legal: "ООО / АО / ПАО",
  individual: "Физическое лицо",
  sole_trader: "ИП",
} as const;

export const CONTRACT_TYPES = {
  framework: "Рамочный",
  one_time: "Разовый",
  service: "Услуги",
} as const;

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatCurrency(amount: string | number | null | undefined, currency = "RUB"): string {
  if (!amount) return "—";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatWeight(weight: string | number | null | undefined): string {
  if (!weight) return "—";
  const num = typeof weight === "string" ? parseFloat(weight) : weight;
  return `${num.toLocaleString("ru-RU", { minimumFractionDigits: 3 })} т`;
}

export function formatVolume(volume: string | number | null | undefined): string {
  if (!volume) return "0";
  const num = typeof volume === "string" ? parseFloat(volume) : volume;
  return num.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}
