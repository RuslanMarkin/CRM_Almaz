import { describe, expect, it } from "vitest";
import type {
  Contract,
  Counterparty,
  Specification,
  Waybill,
} from "../drizzle/schema";
import { generateWaybillPrintHtml } from "./waybillPrintService";

const createdAt = new Date("2026-06-04T09:00:00.000Z");

function counterparty(id: number, name: string, okpo: string): Counterparty {
  return {
    id,
    name,
    shortName: null,
    type: "legal",
    inn: `770000000${id}`,
    ogrn: null,
    kpp: null,
    okpo,
    legalAddress: `г. Москва, ул. Тестовая, ${id}`,
    actualAddress: null,
    bankName: null,
    bankBik: null,
    bankAccount: null,
    corrAccount: null,
    phone: "+7 900 000-00-00",
    email: null,
    notes: null,
    createdAt,
    updatedAt: createdAt,
  };
}

describe("generateWaybillPrintHtml", () => {
  it("renders a safe two-page SP-31 form matching the reference structure", () => {
    const contract: Contract = {
      id: 1,
      number: "ДГ-42",
      counterpartyId: 1,
      type: "framework",
      subject: null,
      startDate: new Date("2026-05-15T00:00:00.000Z"),
      endDate: null,
      amount: null,
      currency: "RUB",
      status: "active",
      notes: null,
      createdAt,
      updatedAt: createdAt,
    };
    const specification: Specification = {
      id: 1,
      number: "СП-7",
      contractId: contract.id,
      counterpartyId: 2,
      loadingAddress: "Элеватор",
      unloadingAddress: "Склад",
      cargoName: "Пшеница",
      pricePerUnit: "12500.00",
      unit: "т",
      currency: "RUB",
      volumeTotal: "100.000",
      volumeShipped: "0.000",
      startDate: null,
      endDate: null,
      status: "active",
      notes: null,
      createdAt,
      updatedAt: createdAt,
    };
    const waybill: Waybill = {
      id: 1,
      number: "ТТН-2026-0001",
      specificationId: specification.id,
      contractId: contract.id,
      supplierId: 1,
      supplierName: "Поставщик",
      loadingAddress: "Элеватор",
      buyerId: 2,
      buyerName: "Покупатель",
      unloadingAddress: "Склад",
      carrierId: 3,
      carrierName: "Перевозчик",
      vehicleOwnerId: 3,
      vehicleOwnerName: "Перевозчик",
      payerId: 2,
      payerName: "Покупатель",
      driverName: "Иванов И.И.",
      vehicleMake: "КамАЗ",
      tractorNumber: "А001АА77",
      trailerNumber: "В002ВВ77",
      tripSheetNumber: "ПЛ-10",
      routeNumber: "М-4",
      garageNumber: "12",
      grossWeight: "28.000",
      tareWeight: "8.500",
      netWeight: "19.500",
      cargoName: "Пшеница <урожай & 2026>",
      cargoGrade: "3 класс",
      impurityPercent: "1.25",
      moisturePercent: "12.50",
      packageType: "н/у",
      quantity: "1.000",
      cargoClass: "1",
      pricePerUnit: "12500.00",
      currency: "RUB",
      status: "draft",
      waybillDate: new Date("2026-06-04T00:00:00.000Z"),
      declarationInfo: "Декларация № 5",
      notes: null,
      pdfKey: null,
      createdAt,
      updatedAt: createdAt,
    };

    const html = generateWaybillPrintHtml({
      waybill,
      contract,
      specification,
      supplier: counterparty(1, "ООО Поставщик", "12345678"),
      buyer: counterparty(2, "ООО Покупатель", "23456789"),
      carrier: counterparty(3, "ООО Перевозчик", "34567890"),
      vehicleOwner: counterparty(3, "ООО Перевозчик", "34567890"),
      payer: counterparty(2, "ООО Покупатель", "23456789"),
    });

    expect(html).toContain("Типовая межотраслевая форма № СП-31");
    expect(html).toContain("Утверждена постановлением Госкомстата России");
    expect(html).toContain("от 29.09.97 № 68");
    expect(html).toContain("Организация - перевозчик");
    expect(html).toContain("Погрузочно-разгрузочные операции");
    expect(html).toContain("Прочие сведения (заполняется организацией-владельцем автотранспорта)");
    expect(html).toContain("Поставщик, ИНН 7700000001");
    expect(html).toContain("Покупатель, ИНН 7700000002");
    expect(html).toContain("Перевозчик, ИНН 7700000003");
    expect(html).toContain("Пшеница &lt;урожай &amp; 2026&gt;");
    expect(html).not.toContain("Пшеница <урожай & 2026>");
    expect(html.match(/<main class="page">/g)).toHaveLength(2);
    expect(html).toContain("@page { size: A4 portrait; margin: 5mm 4mm; }");
    expect(html).not.toContain("A4 landscape");
  });
});
