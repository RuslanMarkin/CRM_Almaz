import fs from "fs";
import path from "path";
import zlib from "zlib";
import type { Counterparty } from "../drizzle/schema";
import type { WaybillPrintData } from "./waybillPrintService";

interface ZipEntry {
  name: string;
  compression: number;
  crc: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  data: Buffer;
}

const TEMPLATE_PATH = path.join(process.cwd(), "server", "templates", "ttn-waybill-template.xlsx");
const CRC_TABLE = makeCrcTable();

function makeCrcTable(): number[] {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    const byte = data[i];
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 0xffff - 22);
  for (let i = buffer.length - 22; i >= min; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) return i;
  }
  throw new Error("Invalid XLSX template: central directory not found");
}

function readZip(buffer: Buffer): ZipEntry[] {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);
  const entries: ZipEntry[] = [];

  let offset = centralDirectoryOffset;
  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("Invalid XLSX template: bad central directory entry");
    }

    const compression = buffer.readUInt16LE(offset + 10);
    const crc = buffer.readUInt32LE(offset + 16);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataOffset, dataOffset + compressedSize);
    const data = compression === 8 ? zlib.inflateRawSync(compressed) : Buffer.from(compressed);

    entries.push({
      name,
      compression,
      crc,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      data,
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

function writeZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = entry.data;
    const compressed = zlib.deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);

    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);

    centralParts.push(central);
    offset += local.length + compressed.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDirectory.length, 12);
  eocd.writeUInt32LE(centralDirectoryOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, eocd]);
}

function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function setCellValue(sheetXml: string, cell: string, value: unknown): string {
  const text = escapeXml(value);
  const replacement = (attrs: string) => {
    const cleanAttrs = attrs
      .replace(/\st="[^"]*"/, "")
      .replace(/\/$/, "")
      .replace(/\s/g, " ")
      .trim();
    return `<c ${cleanAttrs} t="inlineStr"><is><t>${text}</t></is></c>`;
  };

  const selfClosingCellPattern = new RegExp(`<c([^>]*\\sr="${cell}"[^>]*)\\/>`);
  if (selfClosingCellPattern.test(sheetXml)) {
    return sheetXml.replace(selfClosingCellPattern, (_match, attrs: string) => replacement(attrs));
  }

  const cellPattern = new RegExp(`<c([^>]*\\sr="${cell}"[^>]*)>[\\s\\S]*?<\\/c>`);
  if (cellPattern.test(sheetXml)) {
    return sheetXml.replace(cellPattern, (_match, attrs: string) => replacement(attrs));
  }

  const rowNumber = cell.match(/\d+/)?.[0];
  if (!rowNumber) return sheetXml;
  const rowPattern = new RegExp(`(<row[^>]*\\sr="${rowNumber}"[^>]*>)`);
  return sheetXml.replace(rowPattern, `$1${replacement(`r="${cell}"`)}`);
}

function hideRows(sheetXml: string, rows: number[]): string {
  return rows.reduce((sheet, row) => {
    const rowPattern = new RegExp(`<row([^>]*\\sr="${row}"[^>]*)>`, "g");
    return sheet.replace(rowPattern, (match, attrs: string) => {
      const nextAttrs = attrs.includes(" hidden=")
        ? attrs.replace(/\shidden="[^"]*"/, ' hidden="1"')
        : `${attrs} hidden="1"`;
      return `<row${nextAttrs}>`;
    });
  }, sheetXml);
}

function formatDateParts(value: Date | string | null | undefined): {
  day: string;
  month: string;
  monthName: string;
  century: string;
  yearSuffix: string;
  year: string;
} {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return { day: "", month: "", monthName: "", century: "", yearSuffix: "", year: "" };
  }
  const year = String(date.getFullYear());
  return {
    day: String(date.getDate()).padStart(2, "0"),
    month: String(date.getMonth() + 1).padStart(2, "0"),
    monthName: new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(date),
    century: year.slice(0, 2),
    yearSuffix: year.slice(2),
    year,
  };
}

function formatDate(value: Date | string | null | undefined): string {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("ru-RU");
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
  return [
    fallback || party?.name,
    party?.inn ? `ИНН ${party.inn}` : null,
    party?.ogrn ? `ОГРН ${party.ogrn}` : null,
    party?.legalAddress,
    party?.phone,
  ].filter(Boolean).join(", ");
}

function calculateAmount(data: WaybillPrintData): string {
  const net = Number(data.waybill.netWeight);
  const price = Number(data.waybill.pricePerUnit);
  if (!Number.isFinite(net) || !Number.isFinite(price)) return "";
  return formatNumber(net * price, 2);
}

function formatPersonSignatureName(value: string | null | undefined): string {
  const parts = String(value ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] ?? "";
  const [lastName, firstName, middleName] = parts;
  const initials = [firstName, middleName]
    .filter(Boolean)
    .map((part) => `${part[0]}.`)
    .join("");
  return `${lastName} ${initials}`.trim();
}

function basisLine(data: WaybillPrintData): string {
  const contract = data.contract
    ? [
        `Договор № ${data.contract.number}`,
        data.contract.startDate ? `от ${formatDate(data.contract.startDate)}` : null,
      ].filter(Boolean).join(" ")
    : "Договор №";
  const specification = data.specification
    ? [
        `Спец (при наличии) № ${data.specification.number}`,
        data.specification.startDate ? `от ${formatDate(data.specification.startDate)}` : null,
      ].filter(Boolean).join(" ")
    : "Спец (при наличии) №";

  return `${contract}. ${specification}`;
}

function formatFormNumber(value: string): string {
  const parts = value.split("-").map(part => part.trim()).filter(Boolean);
  return parts.at(-1) || value;
}

function updateSheet1(xml: string, data: WaybillPrintData): string {
  const { waybill, supplier, buyer, carrier, vehicleOwner, payer } = data;
  const date = formatDateParts(waybill.waybillDate);
  const organization = carrier ?? supplier;
  const organizationName = carrier ? waybill.carrierName : waybill.supplierName;
  const values: Record<string, unknown> = {
    A1: "",
    BT3: formatFormNumber(waybill.number),
    AI4: date.day,
    AO4: date.monthName,
    BE4: date.yearSuffix,
    CS5: date.day,
    CW5: date.month,
    DA5: date.year,
    N6: "",
    CS6: "",
    N9: partyLine(organization, organizationName),
    CS9: organization?.okpo ?? "",
    S11: waybill.vehicleMake,
    BK11: waybill.tractorNumber,
    CS11: waybill.tripSheetNumber,
    AJ13: partyLine(vehicleOwner, waybill.vehicleOwnerName),
    K15: waybill.driverName,
    O17: partyLine(payer, waybill.payerName),
    L20: partyLine(supplier, waybill.supplierName),
    L22: waybill.loadingAddress,
    R25: partyLine(buyer, waybill.buyerName),
    L28: waybill.unloadingAddress,
    CQ27: waybill.routeNumber,
    AY31: waybill.trailerNumber,
    CQ30: waybill.garageNumber,
    M37: waybill.cargoName,
    M39: waybill.cargoGrade,
    AV39: formatNumber(waybill.impurityPercent),
    CE39: formatNumber(waybill.moisturePercent),
    U45: waybill.packageType || "н/у",
    AB45: formatNumber(waybill.quantity, 3),
    AK45: waybill.cargoClass,
    AS45: formatKg(waybill.grossWeight),
    BB45: formatKg(waybill.tareWeight),
    BK45: formatKg(waybill.netWeight),
    BT45: formatNumber(waybill.pricePerUnit),
    CJ45: calculateAmount(data),
    AZ59: "",
    CA59: "",
    CA61: formatKg(waybill.netWeight),
    W63: "",
    AJ63: "",
    BX63: "",
    CK63: formatPersonSignatureName(waybill.driverName),
    N65: waybill.declarationInfo,
  };

  const sheetWithValues = Object.entries(values).reduce((sheet, [cell, value]) => setCellValue(sheet, cell, value), xml);
  return hideRows(sheetWithValues, [1, 2, 6, 7, 8]);
}

function updateSheet2(xml: string, data: WaybillPrintData): string {
  const { waybill } = data;
  const values: Record<string, unknown> = {
    O15: waybill.supplierName,
    AI15: "механический",
    O16: waybill.buyerName,
  };

  return Object.entries(values).reduce((sheet, [cell, value]) => setCellValue(sheet, cell, value), xml);
}

export function generateWaybillXlsx(data: WaybillPrintData): Buffer {
  const template = fs.readFileSync(TEMPLATE_PATH);
  const entries = readZip(template);

  for (const entry of entries) {
    if (entry.name === "xl/worksheets/sheet1.xml") {
      entry.data = Buffer.from(updateSheet1(entry.data.toString("utf8"), data), "utf8");
    }
    if (entry.name === "xl/worksheets/sheet2.xml") {
      entry.data = Buffer.from(updateSheet2(entry.data.toString("utf8"), data), "utf8");
    }
  }

  return writeZip(entries);
}
