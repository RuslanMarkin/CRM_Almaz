import { z } from "zod";

export const COUNTERPARTY_STATUS_VALUES = [
  "normal",
  "missing_scans",
  "blacklisted",
  "debtor",
] as const;

export const counterpartyStatusSchema = z.enum(COUNTERPARTY_STATUS_VALUES);
export const counterpartyStatusInputSchema = counterpartyStatusSchema.default("normal");
export type CounterpartyStatus = z.infer<typeof counterpartyStatusSchema>;

export const COUNTERPARTY_STATUSES: Record<
  CounterpartyStatus,
  { label: string; color: string }
> = {
  normal: { label: "Норм", color: "bg-emerald-100 text-emerald-700" },
  missing_scans: { label: "Не хватает сканов", color: "bg-amber-100 text-amber-700" },
  blacklisted: { label: "ЧС", color: "bg-red-100 text-red-700" },
  debtor: { label: "Должник", color: "bg-orange-100 text-orange-700" },
};
