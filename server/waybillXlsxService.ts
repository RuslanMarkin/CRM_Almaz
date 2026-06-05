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

const TEMPLATE_PATH = path.join(process.cwd(), "server", "templates", "sp31-waybill-template.xlsx");
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

function formatFormNumber(value: string): string {
  const parts = value.split("-").map(part => part.trim()).filter(Boolean);
  return parts.at(-1) || value;
}

function updateSheet1(xml: string, data: WaybillPrintData): string {
  const { waybill, supplier, buyer, carrier, vehicleOwner, payer } = data;
  const date = formatDateParts(waybill.waybillDate);
  const values: Record<string, unknown> = {
    AA5: formatFormNumber(waybill.number),
    I6: date.day,
    L6: date.monthName,
    U6: date.century,
    V6: date.yearSuffix,
    AK7: date.day,
    AM7: date.month,
    AP7: date.year,
    F9: partyLine(supplier, waybill.supplierName),
    AK9: supplier?.okpo ?? "",
    H10: waybill.vehicleMake,
    X10: waybill.tractorNumber,
    AB10: `к путевому листу № ${waybill.tripSheetNumber ?? ""}`,
    O11: partyLine(carrier, waybill.carrierName),
    O12: partyLine(vehicleOwner, waybill.vehicleOwnerName),
    E15: waybill.driverName,
    Z15: "Автотранспорт",
    E18: partyLine(payer, waybill.payerName),
    E21: partyLine(supplier, waybill.supplierName),
    E24: waybill.loadingAddress,
    H28: partyLine(buyer, waybill.buyerName),
    E32: waybill.unloadingAddress,
    AH31: waybill.routeNumber,
    U35: waybill.trailerNumber,
    F41: waybill.cargoName,
    F72: waybill.declarationInfo,
    A44: `Сорт, класс        ${waybill.cargoGrade ?? ""}`,
    S44: formatNumber(waybill.impurityPercent),
    AG44: formatNumber(waybill.moisturePercent),
    H49: waybill.packageType || "н/у",
    K49: formatNumber(waybill.quantity, 3),
    O49: waybill.cargoClass,
    R49: formatKg(waybill.grossWeight),
    V49: formatKg(waybill.tareWeight),
    Z49: formatKg(waybill.netWeight),
    AE49: formatNumber(waybill.pricePerUnit),
    AK49: calculateAmount(data),
    AG67: formatKg(waybill.netWeight),
    AF70: waybill.driverName,
  };

  return Object.entries(values).reduce((sheet, [cell, value]) => setCellValue(sheet, cell, value), xml);
}

function updateSheet2(xml: string, data: WaybillPrintData): string {
  const { waybill } = data;
  const values: Record<string, unknown> = {
    F16: waybill.supplierName,
    M16: "механический",
    T16: "обязательно к заполнению",
    AB16: "обязательно к заполнению",
    F18: waybill.buyerName,
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
