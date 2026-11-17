import { describe, expect, it } from "vitest";
import { decodeDataUrl, usesS3AttachmentStorage } from "./attachmentStorage";

describe("attachmentStorage & S3 streaming proxy", () => {
  it("правильно декодирует base64 dataUrl в буфер", () => {
    const originalText = "Тестовый скан документа ТД АЛМАЗ";
    const base64 = Buffer.from(originalText, "utf-8").toString("base64");
    const dataUrl = `data:text/plain;base64,${base64}`;

    const buffer = decodeDataUrl(dataUrl);
    expect(buffer.toString("utf-8")).toBe(originalText);
  });

  it("выбрасывает ошибку при некорректном формате dataUrl", () => {
    expect(() => decodeDataUrl("not-a-valid-data-url")).toThrow("Invalid file data");
  });

  it("проверяет функцию usesS3AttachmentStorage", () => {
    expect(typeof usesS3AttachmentStorage()).toBe("boolean");
  });
});
