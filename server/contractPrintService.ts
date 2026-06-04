export interface ContractPrintData {
  contract: {
    number?: string | null;
    type?: string | null;
    subject?: string | null;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
    amount?: string | number | null;
    currency?: string | null;
    status?: string | null;
    notes?: string | null;
    createdAt?: Date | string | null;
  };
  counterparty?: {
    id?: number | null;
    name?: string | null;
    shortName?: string | null;
    type?: string | null;
    inn?: string | null;
    ogrn?: string | null;
    kpp?: string | null;
    legalAddress?: string | null;
    actualAddress?: string | null;
    bankName?: string | null;
    bankBik?: string | null;
    bankAccount?: string | null;
    corrAccount?: string | null;
    phone?: string | null;
    email?: string | null;
  } | null;
}

const TYPE_LABELS: Record<string, string> = {
  framework: "Рамочный",
  one_time: "Разовый",
  service: "Услуги",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Черновик",
  active: "Активный",
  suspended: "Приостановлен",
  completed: "Завершён",
  terminated: "Расторгнут",
};

function escapeHtml(value: unknown): string {
  const str = String(value ?? "");
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function asText(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const str = String(value).trim();
  return str ? str : "—";
}

function asMultiline(value: unknown): string {
  return escapeHtml(asText(value)).replaceAll("\n", "<br>");
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatAmount(value: string | number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const numeric = typeof value === "number" ? value : Number(String(value).replace(",", "."));
  if (Number.isNaN(numeric)) return asText(value);
  const amount = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
  return `${amount} ${currency || "RUB"}`;
}

export function generateContractPrintHtml(data: ContractPrintData): string {
  const contract = data.contract;
  const cp = data.counterparty;

  const contractType = TYPE_LABELS[String(contract.type ?? "")] ?? asText(contract.type);
  const contractStatus = STATUS_LABELS[String(contract.status ?? "")] ?? asText(contract.status);
  const contractNumber = asText(contract.number);
  const contractSubject = asText(contract.subject);
  const amountText = formatAmount(contract.amount, contract.currency);
  const createdAt = formatDate(contract.createdAt);
  const startDate = formatDate(contract.startDate);
  const endDate = formatDate(contract.endDate);
  const partyName = asText(cp?.name);
  const partyShortName = asText(cp?.shortName);
  const partyType = asText(cp?.type);
  const now = new Date().toLocaleString("ru-RU");

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Печатная форма договора ${escapeHtml(contractNumber)}</title>
    <style>
      :root {
        color-scheme: only light;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: "Times New Roman", Times, serif;
        color: #000;
        background: #fff;
      }
      .screen-tools {
        max-width: 210mm;
        margin: 0 auto;
        padding: 10px 18mm 0;
      }
      .screen-tools button {
        border: 1px solid #000;
        background: #fff;
        color: #000;
        font-size: 14px;
        padding: 6px 14px;
        cursor: pointer;
      }
      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        padding: 12mm 18mm 14mm;
      }
      h1 {
        margin: 0 0 8mm;
        font-size: 18pt;
        font-weight: 700;
        text-align: center;
        letter-spacing: 0.2px;
      }
      .meta {
        margin: 0 0 7mm;
        font-size: 11pt;
        line-height: 1.35;
      }
      .meta p {
        margin: 0 0 2mm;
      }
      .section-title {
        margin: 6mm 0 2mm;
        font-size: 11pt;
        font-weight: 700;
        text-transform: uppercase;
      }
      .table {
        width: 100%;
        border-collapse: collapse;
        margin: 0 0 2mm;
      }
      .table td {
        border: 1px solid #000;
        padding: 2.3mm 2.8mm;
        font-size: 11pt;
        vertical-align: top;
      }
      .label {
        width: 37%;
        font-weight: 700;
      }
      .clause {
        margin: 0 0 3mm;
        font-size: 11pt;
        line-height: 1.4;
        text-align: justify;
      }
      .signatures {
        margin-top: 14mm;
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 10mm;
      }
      .signature-box {
        font-size: 11pt;
      }
      .signature-line {
        margin-top: 15mm;
        border-top: 1px solid #000;
        padding-top: 1.5mm;
        font-size: 10pt;
      }
      .footer-note {
        margin-top: 8mm;
        font-size: 10pt;
      }
      @media print {
        .screen-tools {
          display: none;
        }
        @page {
          size: A4;
          margin: 0;
        }
      }
    </style>
  </head>
  <body>
    <div class="screen-tools">
      <button type="button" onclick="window.print()">Печать</button>
    </div>
    <main class="page">
      <h1>ДОГОВОР ${escapeHtml(contractNumber)}</h1>

      <section class="meta">
        <p><strong>Дата формирования печатной формы:</strong> ${escapeHtml(now)}</p>
        <p><strong>Статус:</strong> ${escapeHtml(contractStatus)}</p>
        <p><strong>Тип договора:</strong> ${escapeHtml(contractType)}</p>
        <p><strong>Дата создания в системе:</strong> ${escapeHtml(createdAt)}</p>
      </section>

      <p class="clause">
        Настоящий договор заключён между организацией «Заказчик» и контрагентом
        <strong>${escapeHtml(partyName)}</strong> на условиях, указанных ниже.
      </p>

      <p class="section-title">1. Основные сведения о договоре</p>
      <table class="table">
        <tbody>
          <tr>
            <td class="label">Номер договора</td>
            <td>${escapeHtml(contractNumber)}</td>
          </tr>
          <tr>
            <td class="label">Предмет договора</td>
            <td>${asMultiline(contractSubject)}</td>
          </tr>
          <tr>
            <td class="label">Срок действия</td>
            <td>с ${escapeHtml(startDate)} по ${escapeHtml(endDate)}</td>
          </tr>
          <tr>
            <td class="label">Сумма договора</td>
            <td>${escapeHtml(amountText)}</td>
          </tr>
          <tr>
            <td class="label">Примечания</td>
            <td>${asMultiline(contract.notes)}</td>
          </tr>
        </tbody>
      </table>

      <p class="section-title">2. Данные контрагента</p>
      <table class="table">
        <tbody>
          <tr>
            <td class="label">Полное наименование</td>
            <td>${escapeHtml(partyName)}</td>
          </tr>
          <tr>
            <td class="label">Краткое наименование</td>
            <td>${escapeHtml(partyShortName)}</td>
          </tr>
          <tr>
            <td class="label">Тип</td>
            <td>${escapeHtml(partyType)}</td>
          </tr>
          <tr>
            <td class="label">ИНН / ОГРН / КПП</td>
            <td>${escapeHtml(asText(cp?.inn))} / ${escapeHtml(asText(cp?.ogrn))} / ${escapeHtml(asText(cp?.kpp))}</td>
          </tr>
          <tr>
            <td class="label">Юридический адрес</td>
            <td>${asMultiline(cp?.legalAddress)}</td>
          </tr>
          <tr>
            <td class="label">Фактический адрес</td>
            <td>${asMultiline(cp?.actualAddress)}</td>
          </tr>
          <tr>
            <td class="label">Банк / БИК</td>
            <td>${escapeHtml(asText(cp?.bankName))} / ${escapeHtml(asText(cp?.bankBik))}</td>
          </tr>
          <tr>
            <td class="label">Расчётный / Корр. счёт</td>
            <td>${escapeHtml(asText(cp?.bankAccount))} / ${escapeHtml(asText(cp?.corrAccount))}</td>
          </tr>
          <tr>
            <td class="label">Телефон / Email</td>
            <td>${escapeHtml(asText(cp?.phone))} / ${escapeHtml(asText(cp?.email))}</td>
          </tr>
        </tbody>
      </table>

      <p class="section-title">3. Подписи сторон</p>
      <div class="signatures">
        <div class="signature-box">
          <p><strong>Заказчик</strong></p>
          <p class="signature-line">Ф.И.О., подпись, печать</p>
        </div>
        <div class="signature-box">
          <p><strong>Контрагент</strong></p>
          <p class="signature-line">${escapeHtml(partyName)} / подпись / печать</p>
        </div>
      </div>

      <p class="footer-note">
        Печатная форма сформирована автоматически на основании данных договора и карточки контрагента.
      </p>
    </main>
  </body>
</html>`;
}
