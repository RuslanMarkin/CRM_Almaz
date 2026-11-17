import { z } from "zod";

export const COUNTERPARTY_VAT_VALUES = ["with_vat", "without_vat"] as const;
export const counterpartyVatSchema = z.enum(COUNTERPARTY_VAT_VALUES);
export const counterpartyVatInputSchema = counterpartyVatSchema.default("with_vat");
export type CounterpartyVatType = z.infer<typeof counterpartyVatSchema>;

export const COUNTERPARTY_VAT_TYPES: Record<
  CounterpartyVatType,
  { label: string; shortLabel: string; badgeColor: string; description: string }
> = {
  with_vat: {
    label: "С НДС (ОСНО)",
    shortLabel: "С НДС",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    description: "Общая система налогообложения (ОСНО)",
  },
  without_vat: {
    label: "Без НДС (УСН)",
    shortLabel: "Без НДС",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    description: "Упрощённая система налогообложения (УСН / спецрежим)",
  },
};

export interface StatutoryRequirement {
  id: string;
  title: string;
  required: boolean;
  hint?: string;
}

export const STATUTORY_REQUIREMENTS: Record<CounterpartyVatType, StatutoryRequirement[]> = {
  with_vat: [
    { id: "charter", title: "Устав (со всеми изменениями и отметкой ФНС)", required: true },
    { id: "egrul", title: "Выписка / Лист записи ЕГРЮЛ", required: true },
    { id: "inn_kpp", title: "Свидетельство о постановке на учет (ИНН / КПП)", required: true },
    { id: "director_decision", title: "Решение / Протокол о назначении директора", required: true },
    { id: "director_order", title: "Приказ о вступлении директора в должность", required: true },
    { id: "vat_declaration", title: "Декларация по НДС за последний квартал (с квитанцией ФНС)", required: true, hint: "Обязательно для подтверждения работы с НДС" },
    { id: "accounting_balance", title: "Бухгалтерский баланс (форма 1 и 2 с отметкой ФНС)", required: true },
    { id: "tax_debt_certificate", title: "Справка об отсутствии задолженности по налогам (КНД 1120101)", required: false },
    { id: "lease_contract", title: "Договор аренды офиса / склада / базы", required: false },
  ],
  without_vat: [
    { id: "usn_notice", title: "Уведомление / информационное письмо о применении УСН (форма 26.2-7)", required: true, hint: "Подтверждение работы без НДС" },
    { id: "egrip_egrul", title: "Лист записи ЕГРИП / ЕГРЮЛ (Свидетельство ОГРНИП / ОГРН)", required: true },
    { id: "inn", title: "Свидетельство ИНН", required: true },
    { id: "passport_or_appointment", title: "Паспорт ИП / Решение о назначении руководителя", required: true },
    { id: "tax_debt_certificate", title: "Справка об отсутствии задолженности перед бюджетом", required: false },
    { id: "bank_details", title: "Справка банка об открытых счетах", required: false },
  ],
};
