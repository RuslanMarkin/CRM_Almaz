import type {
  Contract,
  Counterparty,
  Specification,
  Waybill,
} from "../drizzle/schema";

export interface WaybillPrintData {
  waybill: Waybill;
  contract?: Contract | null;
  specification?: Specification | null;
  supplier?: Counterparty | null;
  buyer?: Counterparty | null;
  carrier?: Counterparty | null;
  vehicleOwner?: Counterparty | null;
  payer?: Counterparty | null;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function text(value: unknown): string {
  const normalized = String(value ?? "").trim();
  return normalized ? escapeHtml(normalized) : "&nbsp;";
}

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU");
}

function formatYear(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : String(date.getFullYear());
}

function formatNumber(value: string | number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}

function formatKg(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const tons = Number(value);
  return Number.isFinite(tons) ? formatNumber(tons * 1000, 0) : String(value);
}

function partyLine(party: Counterparty | null | undefined, fallback?: string | null): string {
  const parts = [
    fallback || party?.name,
    party?.inn ? `ИНН ${party.inn}` : null,
    party?.ogrn ? `ОГРН ${party.ogrn}` : null,
    party?.legalAddress,
    party?.phone,
  ].filter(Boolean);
  return parts.join(", ");
}

function partyOkpo(party: Counterparty | null | undefined): string {
  return party?.okpo ?? "";
}

function calculateAmount(waybill: Waybill): string {
  const net = Number(waybill.netWeight);
  const price = Number(waybill.pricePerUnit);
  if (!Number.isFinite(net) || !Number.isFinite(price)) return "";
  return formatNumber(net * price, 2);
}

export function generateWaybillPrintHtml(data: WaybillPrintData): string {
  const { waybill, contract, specification, supplier, buyer, carrier, vehicleOwner, payer } = data;
  const contractDate = contract?.startDate ?? contract?.createdAt;
  const shipperLine = partyLine(supplier, waybill.supplierName);
  const buyerLine = partyLine(buyer, waybill.buyerName);
  const carrierLine = partyLine(carrier, waybill.carrierName);
  const ownerLine = partyLine(vehicleOwner, waybill.vehicleOwnerName);
  const payerLine = partyLine(payer, waybill.payerName);

  return `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>ТТН СП-31 № ${escapeHtml(waybill.number)}</title>
    <style>
      * { box-sizing: border-box; }
      body { margin: 0; color: #000; background: #e9e9e9; font-family: "Times New Roman", serif; }
      .tools { position: sticky; top: 0; z-index: 10; display: flex; gap: 8px; padding: 10px 16px; background: #fff; border-bottom: 1px solid #aaa; }
      .tools button { padding: 7px 14px; border: 1px solid #222; background: #fff; cursor: pointer; font: 14px Arial, sans-serif; }
      .page {
        width: 210mm; min-height: 297mm; margin: 10px auto; padding: 11mm 7mm 8mm;
        background: #fff; box-shadow: 0 2px 12px #0002; page-break-after: always;
        font-size: 6.7pt; line-height: 1.08;
      }
      .page:last-child { page-break-after: auto; }
      table { width: 100%; border-collapse: collapse; table-layout: fixed; }
      td, th { padding: .55mm .7mm; vertical-align: middle; font-weight: 400; }
      .boxed td, .boxed th { border: .25mm solid #000; }
      .boxed th { text-align: center; }
      .gray { background: #ddd; }
      .red { color: #e00000; }
      .center { text-align: center; }
      .right { text-align: right; }
      .bold { font-weight: 700; }
      .tiny { font-size: 5.6pt; }
      .micro { font-size: 4.7pt; line-height: 1; }
      .fill { min-height: 4.3mm; background: #ddd; padding: .8mm 1.2mm; text-align: center; }
      .underline { border-bottom: .25mm solid #000; min-height: 3.2mm; padding: .3mm 1mm; text-align: center; }
      .caption { margin-top: .3mm; text-align: center; font-size: 4.6pt; }
      .spacer { height: 1.2mm; }
      .section-title { margin: 1.3mm 0 .7mm; font-size: 7.2pt; font-weight: 700; text-align: center; }
      .top { display: grid; grid-template-columns: 1fr 54mm; align-items: end; column-gap: 4mm; }
      .contract-note { width: 58mm; min-height: 11mm; padding: 2mm; background: #ddd; color: #d00000; font-weight: 700; }
      .form-name { text-align: right; font-size: 5.7pt; }
      h1 { margin: 2.5mm 0 1mm; text-align: center; font-size: 9.5pt; line-height: 1; }
      .title-line { display: grid; grid-template-columns: 1fr 30mm; align-items: end; gap: 1.5mm; }
      .title-number { min-height: 5mm; padding: 1mm; background: #ddd; text-align: center; }
      .codes { width: 27mm; margin-left: auto; }
      .codes td { border: .25mm solid #000; padding: .7mm; text-align: center; }
      .codes .label { border: 0; }
      .field-row { display: grid; grid-template-columns: 31mm 1fr 18mm; align-items: center; gap: 1mm; margin-top: .6mm; }
      .field-row.no-code { grid-template-columns: 31mm 1fr; }
      .field-row.vehicle { grid-template-columns: 31mm 23mm 32mm 1fr 26mm; }
      .field-row.loading { grid-template-columns: 31mm 1fr 31mm 25mm; }
      .field-row.trailer { grid-template-columns: 31mm 1fr 20mm 13mm; }
      .field-label { line-height: 1; }
      .code-box { min-height: 5mm; border: .25mm solid #000; padding: 1mm; text-align: center; }
      .cargo-accounts { display: grid; grid-template-columns: 34mm 1fr 18mm 31mm 18mm; align-items: center; gap: 1mm; margin-top: 1.5mm; }
      .account { height: 9mm; border: .25mm solid #000; }
      .product-line { display: grid; grid-template-columns: 24mm 1fr; align-items: center; gap: 2mm; margin-top: 1.1mm; }
      .quality { display: grid; grid-template-columns: 22mm 25mm 27mm 1fr 20mm 1fr 5mm; align-items: end; gap: 1mm; margin: 2mm 0 1mm; }
      .cargo th { height: 7mm; font-size: 5.3pt; line-height: .98; }
      .cargo td { height: 4.8mm; text-align: center; }
      .cargo .numbers td, .fees .numbers td, .operations .numbers td, .transport .numbers td, .calc .numbers td { height: 3.5mm; font-size: 5pt; }
      .fees { width: 82%; margin: 1.5mm 0 1.5mm auto; }
      .fees th { height: 7mm; font-size: 5.3pt; line-height: .98; }
      .fees td { height: 4mm; text-align: center; }
      .payment { display: grid; grid-template-columns: 1fr 17mm; gap: 2mm; align-items: end; }
      .payment-boxes { display: grid; grid-template-rows: 8mm 8mm; }
      .payment-boxes > div { border: .25mm solid #000; }
      .signature-row { display: grid; grid-template-columns: 34mm 1fr 1fr 1fr; gap: 1.5mm; align-items: end; margin-top: 1.3mm; }
      .signature-row.driver { grid-template-columns: 25mm 1fr 1fr 18mm 1fr 1fr; }
      .attachment { display: grid; grid-template-columns: 26mm 1fr 8mm 18mm; gap: 1.5mm; align-items: end; margin-top: 1.4mm; }
      .notes { margin-top: 3mm; color: #e00000; font-size: 5.6pt; line-height: 1.35; }
      .reverse-title { margin: 1mm 0 4mm; text-align: center; font-size: 7pt; }
      .acceptance { display: grid; grid-template-columns: 1fr 1fr; gap: 9mm; margin: 0 1mm 3mm; }
      .acceptance-block { display: grid; grid-template-columns: 34mm 1fr; gap: 1.5mm; align-items: end; }
      .operations th { height: 8mm; line-height: 1; }
      .operations td { height: 5.5mm; text-align: center; }
      .ops-bottom { display: grid; grid-template-columns: 92mm 1fr; gap: 3mm; margin-top: 3mm; }
      .transport-services div { min-height: 8mm; border-bottom: .25mm solid #000; padding-top: 3mm; }
      .transport { margin-top: 3mm; }
      .transport th { height: 7mm; line-height: 1; }
      .transport td { height: 5mm; text-align: center; }
      .calc-grid { display: grid; grid-template-columns: 62mm 62mm 1fr; gap: 2mm; margin-top: 4mm; align-items: start; }
      .calc th { height: 9mm; line-height: 1; }
      .calc td { height: 5mm; text-align: center; }
      .tax-lines { padding-left: 2mm; }
      .tax-lines div { min-height: 9mm; border-bottom: .25mm solid #000; padding-top: 4mm; }
      @media print {
        body { background: #fff; }
        .tools { display: none; }
        .page { margin: 0; box-shadow: none; }
        @page { size: A4 portrait; margin: 0; }
      }
    </style>
  </head>
  <body>
    <div class="tools">
      <button type="button" onclick="window.print()">Печать / сохранить PDF</button>
      <button type="button" onclick="window.close()">Закрыть</button>
    </div>

    <main class="page">
      <div class="top">
        <div class="contract-note">
          Договор № ${text(contract?.number)} от ${text(formatDate(contractDate))}.
          Спец. № ${text(specification?.number)} от ${text(formatDate(specification?.startDate))}
        </div>
        <div class="form-name">Типовая межотраслевая форма № СП-31</div>
      </div>

      <div class="title-line">
        <h1>ТОВАРНО-ТРАНСПОРТНАЯ НАКЛАДНАЯ (зерно) №</h1>
        <div class="title-number">${text(waybill.number)}</div>
      </div>

      <table>
        <tr>
          <td style="width: 70%"></td>
          <td class="right">Коды</td>
          <td style="width: 18mm"></td>
        </tr>
        <tr>
          <td class="center">«&nbsp;&nbsp;&nbsp;&nbsp;»&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${text(formatYear(waybill.waybillDate))} г.</td>
          <td class="right">Форма по ОКУД</td>
          <td class="code-box">0325031</td>
        </tr>
        <tr>
          <td></td>
          <td class="right">Дата составления</td>
          <td class="code-box gray">${text(formatDate(waybill.waybillDate))}</td>
        </tr>
      </table>

      <div class="field-row">
        <div class="field-label">Поставщик</div>
        <div>
          <div class="fill">${text(shipperLine)}</div>
          <div class="caption">(поставщик по договору поставки, ИНН, юридический адрес)</div>
        </div>
        <div class="code-box gray">${text(partyOkpo(supplier))}</div>
      </div>
      <div class="field-row">
        <div class="field-label">Организация</div>
        <div>
          <div class="fill">${text(carrierLine)}</div>
          <div class="caption">Лицо-составитель ТТН (поставщик, грузоотправитель или транспортная компания)</div>
        </div>
        <div class="code-box gray">${text(partyOkpo(carrier))}</div>
      </div>
      <div class="field-row vehicle">
        <div>Марка автомобиля</div>
        <div class="fill">${text(waybill.vehicleMake)}</div>
        <div>Государственный номерной знак</div>
        <div class="fill">${text(waybill.tractorNumber)}</div>
        <div>к путевому листу № ${text(waybill.tripSheetNumber)}</div>
      </div>
      <div class="field-row no-code">
        <div>Организация-владелец автотранспорта</div>
        <div>
          <div class="fill">${text(ownerLine)}</div>
          <div class="caption">(наименование, адрес, номер телефона)</div>
        </div>
      </div>
      <div class="field-row no-code">
        <div>Водитель</div>
        <div>
          <div class="fill">${text(waybill.driverName)} <span style="float:right">автоперевозка</span></div>
          <div class="caption">(фамилия, имя, отчество) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; (вид перевозки)</div>
        </div>
      </div>
      <div class="field-row no-code">
        <div>Заказчик<br />(плательщик)</div>
        <div>
          <div class="fill">${text(payerLine)}</div>
          <div class="caption">(наименование, адрес, номер телефона)</div>
        </div>
      </div>
      <div class="field-row no-code">
        <div>Грузоот-<br />правитель</div>
        <div>
          <div class="fill">${text(shipperLine)}</div>
          <div class="caption">(наименование, адрес, номер телефона)</div>
        </div>
      </div>
      <div class="field-row loading">
        <div>Пункт<br />погрузки</div>
        <div>
          <div class="fill">${text(waybill.loadingAddress)}</div>
          <div class="caption">(адрес)</div>
        </div>
        <div>Отделение (цех),<br />бригада, звено</div>
        <div class="code-box">&nbsp;</div>
      </div>
      <div class="field-row no-code">
        <div>Грузополучатель</div>
        <div>
          <div class="fill">${text(buyerLine)}</div>
          <div class="caption">(наименование, адрес, номер телефона)</div>
        </div>
      </div>
      <div class="field-row loading">
        <div>Пункт<br />разгрузки</div>
        <div>
          <div class="fill">${text(waybill.unloadingAddress)}</div>
          <div class="caption">(адрес)</div>
        </div>
        <div></div>
        <div class="code-box">${text(waybill.routeNumber)}</div>
      </div>
      <div class="field-row trailer">
        <div>Прицеп: Государственный номерной знак</div>
        <div class="fill">${text(waybill.trailerNumber)}</div>
        <div>Гаражный номер</div>
        <div class="code-box">${text(waybill.garageNumber)}</div>
      </div>

      <div class="cargo-accounts">
        <div class="bold">Сведения о грузе</div>
        <div></div>
        <div>Счет<br />(дебет)</div>
        <div class="account"></div>
        <div>Счет<br />(кредит)</div>
      </div>
      <div class="product-line">
        <div>Продукция</div>
        <div>
          <div class="fill bold red">${text(waybill.cargoName)}</div>
          <div class="caption">(наименование зерновых и масляничных культур, семян, трав)</div>
        </div>
      </div>
      <div class="quality">
        <div>Сорт, класс</div><div class="underline">${text(waybill.cargoGrade)}</div>
        <div>Засоренность</div><div class="underline">${text(formatNumber(waybill.impurityPercent))}</div><div>%&nbsp;&nbsp; Влажность</div>
        <div class="underline">${text(formatNumber(waybill.moisturePercent))}</div><div>%</div>
      </div>

      <table class="boxed cargo">
        <colgroup>
          <col style="width: 18%"><col style="width: 5%"><col style="width: 10%"><col style="width: 9%">
          <col style="width: 9%"><col style="width: 8%"><col style="width: 9%"><col style="width: 18%"><col style="width: 14%">
        </colgroup>
        <thead>
          <tr><th rowspan="2">Операция</th><th rowspan="2">Вид<br />упа-<br />ковки</th><th rowspan="2">Коли-<br />чество</th><th rowspan="2">Класс<br />груза</th><th colspan="3">Масса, кг</th><th rowspan="2">Цена, руб. коп.</th><th rowspan="2">Сумма, руб. коп.</th></tr>
          <tr><th>брутто</th><th>тара</th><th>нетто</th></tr>
        </thead>
        <tbody>
          <tr class="numbers"><td></td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td><td>6</td><td>7</td><td>8</td></tr>
          <tr><td class="left">Отправлено</td><td>${text(waybill.packageType || "н/у")}</td><td>${text(formatNumber(waybill.quantity, 3))}</td><td>${text(waybill.cargoClass)}</td><td class="gray">${text(formatKg(waybill.grossWeight))}</td><td class="gray">${text(formatKg(waybill.tareWeight))}</td><td class="gray">${text(formatKg(waybill.netWeight))}</td><td class="gray">${text(formatNumber(waybill.pricePerUnit))}</td><td class="gray">${text(calculateAmount(waybill))}</td></tr>
          <tr><td class="left">Принято</td><td></td><td></td><td>Х</td><td></td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>

      <table class="boxed fees">
        <thead><tr><th>За ценные<br />сорта</th><th>За сортировку<br />и упаковку</th><th>За тару</th><th>За доставку<br />продукции</th><th>Прочие<br />доплаты</th><th>Всего к оплате</th></tr></thead>
        <tbody><tr class="numbers"><td>9</td><td>10</td><td>11</td><td>12</td><td>13</td><td>14</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody>
      </table>

      <div class="payment">
        <div>
          <div>Надбавки - руб. коп. <span class="underline" style="display:inline-block;width:65%">&nbsp;</span></div>
          <div style="margin-top:1mm">Сумма к оплате <span class="underline" style="display:inline-block;width:69%">&nbsp;</span></div>
          <div class="caption">(прописью)</div>
          <div class="right"><span class="underline" style="display:inline-block;width:70%">&nbsp;</span> руб. <span class="underline" style="display:inline-block;width:11mm">&nbsp;</span> коп.</div>
        </div>
        <div class="payment-boxes"><div>Счет<br />(дебет)</div><div>Счет<br />(кредит)</div></div>
      </div>

      <div class="signature-row">
        <div>Отпуск разрешил</div>
        <div><div class="fill">Лицо-составитель ТТН</div><div class="caption">(должность)</div></div>
        <div><div class="fill">&nbsp;</div><div class="caption">(подпись)</div></div>
        <div><div class="fill">&nbsp;</div><div class="caption">(расшифровка подписи)</div></div>
      </div>
      <div style="margin-top:1.4mm">Продукцию к перевозке: количество мест <span class="underline" style="display:inline-block;width:35mm">&nbsp;</span> массой, нетто, кг <span class="underline" style="display:inline-block;width:28mm">${text(formatKg(waybill.netWeight))}</span></div>
      <div class="signature-row driver">
        <div>сдал</div>
        <div><div class="fill">Лицо-составитель ТТН</div><div class="caption">(должность)</div></div>
        <div><div class="fill">&nbsp;</div><div class="caption">(подпись)</div></div>
        <div>принял</div>
        <div><div class="fill">водитель</div><div class="caption">(должность)</div></div>
        <div><div class="fill">${text(waybill.driverName)}</div><div class="caption">(подпись, расшифровка)</div></div>
      </div>
      <div class="attachment">
        <div>Приложение</div>
        <div><div class="underline red">${text(waybill.declarationInfo)}</div><div class="caption">(свидетельство, паспорт, сертификаты и т.д.)</div></div>
        <div>на</div>
        <div><span class="underline" style="display:inline-block;width:12mm">&nbsp;</span> листах</div>
      </div>
      <div class="notes">
        <div>Примечание:</div>
        <div>* ПЕЧАТЬ на ТТН проставляет ГРУЗООТПРАВИТЕЛЬ</div>
        <div>** Строки, обозначенные «V», подлежат обязательному заполнению</div>
        <div>*** ТТН оформляется в 4-х экземплярах</div>
      </div>
    </main>

    <main class="page">
      <div class="reverse-title">Оборотная сторона формы № СП-31</div>
      <div class="acceptance">
        <div class="acceptance-block">
          <div>Продукцию по массе,<br />качеству и ассортименту<br />принял</div>
          <div>
            <div class="underline">&nbsp;</div>
            <div class="caption">(должность, подпись, расшифровка подписи)</div>
          </div>
        </div>
        <div>
          <div class="acceptance-block"><div>В весовом<br />журнале</div><div class="underline">&nbsp;</div></div>
          <div class="acceptance-block"><div>Весовщик</div><div><div class="underline">&nbsp;</div><div class="caption">(подпись, расшифровка подписи)</div></div></div>
        </div>
      </div>
      <div class="acceptance">
        <div class="acceptance-block"><div>Способ определения массы:</div><div class="underline">при приеме</div></div>
        <div class="acceptance-block"><div></div><div class="underline">при сдаче</div></div>
      </div>

      <div class="section-title">Погрузочно-разгрузочные операции</div>
      <table class="boxed operations">
        <colgroup><col style="width:12%"><col style="width:20%"><col style="width:17%"><col style="width:17%"><col style="width:17%"><col style="width:17%"></colgroup>
        <thead><tr><th>Операция</th><th>Исполнитель<br />(АТП, отправитель,<br />получатель)</th><th>Способ<br />(ручной,<br />механический)</th><th colspan="3">Время, ч., мин.</th></tr><tr><th></th><th></th><th></th><th>прибытия</th><th>убытия</th><th>простоя</th></tr></thead>
        <tbody>
          <tr class="numbers"><td>15</td><td>16</td><td>17</td><td>18</td><td>19</td><td>20</td></tr>
          <tr><td>Погрузка</td><td class="red">${text(waybill.supplierName)}</td><td class="red">механический</td><td class="red">обязательно к заполнению</td><td class="red">обязательно к заполнению</td><td></td></tr>
          <tr><td>Разгрузка</td><td>${text(waybill.buyerName)}</td><td></td><td></td><td></td><td></td></tr>
        </tbody>
      </table>

      <div class="ops-bottom">
        <table class="boxed operations">
          <thead><tr><th colspan="2">Дополнительные операции</th><th rowspan="2">Подпись<br />ответственного<br />лица</th></tr><tr><th>время, мин.</th><th>наименование,<br />количество</th></tr></thead>
          <tbody><tr class="numbers"><td>21</td><td>22</td><td>23</td></tr><tr><td></td><td></td><td class="red">ФИО ответственного за погрузку</td></tr><tr><td></td><td></td><td></td></tr></tbody>
        </table>
        <div class="transport-services">
          <div>Транспортные услуги</div>
          <div>Отметки о составленных актах</div>
          <div>&nbsp;</div>
        </div>
      </div>

      <div class="section-title">Прочие сведения (заполняется организацией-владельцем автотранспорта)</div>
      <table class="boxed transport">
        <thead><tr><th colspan="5">Расстояние перевозки по группам дорог, км</th><th rowspan="2">Код экспе-<br />дитора</th><th colspan="2">За транспортные услуги</th></tr><tr><th>всего</th><th>в городе</th><th>I группа</th><th>II группа</th><th>III группа</th><th>с клиента</th><th>водителю</th></tr></thead>
        <tbody><tr class="numbers"><td>24</td><td>25</td><td>26</td><td>27</td><td>28</td><td>29</td><td>30</td><td>31</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody>
      </table>

      <div class="calc-grid">
        <table class="boxed calc">
          <thead><tr><th colspan="2">Поправочный<br />коэффициент</th><th rowspan="2"></th></tr><tr><th>расценка<br />водителю</th><th>основной<br />тариф</th></tr></thead>
          <tbody><tr class="numbers"><td>32</td><td>33</td><td>34</td></tr><tr><td></td><td></td><td></td></tr></tbody>
        </table>
        <table class="boxed calc">
          <thead><tr><th rowspan="2">Расчет<br />стоимости</th><th rowspan="2">За тонны</th><th></th><th></th><th></th></tr><tr><th></th><th></th><th></th></tr></thead>
          <tbody><tr class="numbers"><td></td><td>35</td><td>36</td><td>37</td><td>38</td></tr><tr><td>Выполнено<br />Расценка, руб. коп.<br />К оплате, руб. коп.</td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td></tr></tbody>
        </table>
        <div></div>
      </div>

      <div class="calc-grid" style="grid-template-columns: 112mm 1fr; margin-top:3mm">
        <table class="boxed calc">
          <thead><tr><th>Погрузочно-<br />разгрузочные<br />работы,<br />т</th><th colspan="2">Сверхнормативный<br />простой</th><th>Прочие<br />доплаты</th><th>Скидка за<br />сокращение<br />простоя</th><th>Всего</th></tr><tr><th></th><th>погрузка</th><th>разгрузка</th><th></th><th></th><th></th></tr></thead>
          <tbody><tr class="numbers"><td>39</td><td>40</td><td>41</td><td>42</td><td>43</td><td>44</td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody>
        </table>
        <div class="tax-lines">
          <div>Таксировка</div>
          <div>&nbsp;</div>
          <div>Таксировщик</div>
          <div class="caption">(подпись, расшифровка подписи)</div>
        </div>
      </div>
    </main>
  </body>
</html>`;
}
