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
    { id: "counterparty_card", title: "Карта контрагента (с реквизитами, контактами и ЭДО)", required: true },
    { id: "inn_kpp", title: "Свидетельство о постановке на учет (ИНН / КПП)", required: true },
    { id: "ogrn", title: "Свидетельство ОГРН / Лист записи ЕГРЮЛ", required: true },
    { id: "charter", title: "Устав (в действующей редакции)", required: true },
    { id: "director_decision", title: "Решение / Протокол о назначении руководителя", required: true },
    { id: "director_orders", title: "Приказы о вступлении в должность директора и главбуха", required: true },
    { id: "director_passport", title: "Паспорт руководителя", required: true },
    { id: "rosstat_notice", title: "Уведомление из органов статистики (Росстат)", required: false },
    { id: "bank_card", title: "Банковская карточка с образцами подписей", required: true },
    { id: "tax_consent_102", title: "Согласие на признание сведений общедоступными (ст. 102 НК РФ, квитанция)", required: true, hint: "Проверка цепочки контрагентов по НДС" },
    { id: "vat_declaration", title: "Налоговая отчетность по НДС за прошлые периоды (с квитанцией ФНС)", required: true, hint: "Обязательно для подтверждения работы с НДС" },
    { id: "vat_payment_orders", title: "Платежные поручения об уплате НДС / книга покупок и продаж", required: false },
    { id: "accounting_balance", title: "Бухгалтерская отчетность и Декларация по налогу на прибыль (с квитанцией)", required: true },
    { id: "egrul_fresh", title: "Выписка из ЕГРЮЛ (свежая, не старше 1 месяца)", required: true },
    { id: "stat_agro_reports", title: "Статистическая отчетность сельхозпроизводителя (1-фермер / 4-сх, 2-фермер / 29-сх)", required: false },
    { id: "land_documents", title: "Правоустанавливающие документы на земельные участки (ЕГРН / аренда)", required: false },
    { id: "quality_certificates", title: "Декларация о соответствии, протоколы испытаний, справка о пестицидах и ГМО", required: false },
  ],
  without_vat: [
    { id: "counterparty_card", title: "Карта контрагента (с реквизитами, контактами и ЭДО)", required: true },
    { id: "inn", title: "Свидетельство ИНН", required: true },
    { id: "ogrnip_ogrn", title: "Свидетельство ОГРНИП / ОГРН / Лист записи ЕГРИП", required: true },
    { id: "usn_eshn_notice", title: "Уведомление ИФНС о применении ЕСХН / УСН или освобождении от НДС", required: true, hint: "Подтверждение работы без НДС" },
    { id: "passport", title: "Паспорт ИП / главы КФХ / руководителя", required: true },
    { id: "bank_card", title: "Банковская карточка с образцами подписей", required: true },
    { id: "rosstat_notice", title: "Уведомление из органов статистики (Росстат)", required: false },
    { id: "eshn_declaration", title: "Декларация об уплате ЕСХН / УСН с отметкой ФНС", required: false },
    { id: "egrip_fresh", title: "Выписка из ЕГРИП / ЕГРЮЛ (свежая, не старше 1 месяца)", required: true },
    { id: "land_documents", title: "Правоустанавливающие документы на земельные участки (ЕГРН / аренда)", required: false },
    { id: "stat_agro_reports", title: "Статистическая отчетность сельхозпроизводителя (1-фермер / 4-сх, 2-фермер / 29-сх)", required: false },
    { id: "quality_certificates", title: "Декларация о соответствии, протоколы испытаний, справка о пестицидах и ГМО", required: false },
  ],
};
