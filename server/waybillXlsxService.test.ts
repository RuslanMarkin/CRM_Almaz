import zlib from "zlib";
import { describe, expect, it } from "vitest";
import type { Counterparty, Waybill } from "../drizzle/schema";
import { generateWaybillXlsx } from "./waybillXlsxService";

function readZipEntry(buffer: Buffer, entryName: string): string {
  const eocdOffset = (() => {
    const min = Math.max(0, buffer.length - 0xffff - 22);
    for (let i = buffer.length - 22; i >= min; i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) return i;
    }
    throw new Error("Central directory not found");
  })();
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let offset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < entryCount; i++) {
    const compression = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");

    if (name === entryName) {
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const data = buffer.subarray(dataOffset, dataOffset + compressedSize);
      return (compression === 8 ? zlib.inflateRawSync(data) : data).toString("utf8");
    }

    offset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`${entryName} not found`);
}

function cellText(sheetXml: string, cell: string): string {
  const match = sheetXml.match(new RegExp(`<c[^>]*\\sr="${cell}"[^>]*>[\\s\\S]*?<t>([\\s\\S]*?)<\\/t>[\\s\\S]*?<\\/c>`));
  return match?.[1] ?? "";
}

function rowIsHidden(sheetXml: string, row: number): boolean {
  return new RegExp(`<row[^>]*\\sr="${row}"[^>]*\\shidden="1"`).test(sheetXml);
}

describe("generateWaybillXlsx", () => {
  it("hides the supplier header block while keeping shipper data elsewhere", () => {
    const supplier = {
      id: 1,
      name: "АгроНива Дон",
      inn: "6165224587",
      ogrn: "1186196043210",
      okpo: "42567891",
      legalAddress: "Ростовская обл., г. Ростов-на-Дону, ул. Береговая, д. 18",
      phone: "+7 (863) 245-18-40",
    } as Counterparty;
    const waybill = {
      number: "ТТН-014",
      supplierName: "АгроНива Дон",
      loadingAddress: "Ростовская обл., склад 1",
      waybillDate: new Date("2026-06-26T00:00:00.000Z"),
    } as Waybill;

    const xlsx = generateWaybillXlsx({ waybill, supplier });
    const sheet1 = readZipEntry(xlsx, "xl/worksheets/sheet1.xml");

    expect(cellText(sheet1, "N6")).toBe("");
    expect(cellText(sheet1, "CS6")).toBe("");
    expect(cellText(sheet1, "A1")).toBe("");
    expect(rowIsHidden(sheet1, 1)).toBe(true);
    expect(rowIsHidden(sheet1, 2)).toBe(true);
    expect(rowIsHidden(sheet1, 6)).toBe(true);
    expect(rowIsHidden(sheet1, 7)).toBe(true);
    expect(rowIsHidden(sheet1, 8)).toBe(true);
    expect(cellText(sheet1, "L20")).toContain("АгроНива Дон");
  });
});
