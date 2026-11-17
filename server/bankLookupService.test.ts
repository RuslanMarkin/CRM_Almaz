import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBankLookupCache,
  isDaDataConfigured,
  lookupBankByBik,
} from "./bankLookupService";

describe("bankLookupService", () => {
  beforeEach(() => {
    clearBankLookupCache();
    delete process.env.DADATA_API_KEY;
    delete process.env.DADATA_TOKEN;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearBankLookupCache();
  });

  it("returns null for invalid or non-9-digit BIK", async () => {
    expect(await lookupBankByBik("")).toBeNull();
    expect(await lookupBankByBik("123")).toBeNull();
    expect(await lookupBankByBik("04452522")).toBeNull();
    expect(await lookupBankByBik("04452522500")).toBeNull();
    expect(await lookupBankByBik("abcdefghi")).toBeNull();
  });

  it("resolves major Russian banks from local catalog when DaData key is not set", async () => {
    // Sberbank
    const sber = await lookupBankByBik("044525225");
    expect(sber).not.toBeNull();
    expect(sber?.bankName).toBe("ПАО СБЕРБАНК");
    expect(sber?.corrAccount).toBe("30101810400000000225");
    expect(sber?.source).toBe("catalog");

    // VTB
    const vtb = await lookupBankByBik("044525411");
    expect(vtb).not.toBeNull();
    expect(vtb?.bankName).toContain("ВТБ");
    expect(vtb?.corrAccount).toBe("30101810145250000411");

    // T-Bank (Tinkoff)
    const tbank = await lookupBankByBik("044525974");
    expect(tbank).not.toBeNull();
    expect(tbank?.bankName).toContain("ТБанк");
    expect(tbank?.corrAccount).toBe("30101810145250000974");

    // Rosselkhozbank
    const rshb = await lookupBankByBik("044525268");
    expect(rshb).not.toBeNull();
    expect(rshb?.bankName).toContain("РОССЕЛЬХОЗБАНК");

    // Formatted BIK with spaces
    const spaced = await lookupBankByBik(" 044 525 225 ");
    expect(spaced?.bankName).toBe("ПАО СБЕРБАНК");
  });

  it("calls DaData API when DADATA_API_KEY is configured", async () => {
    process.env.DADATA_API_KEY = "test-token-12345";
    expect(isDaDataConfigured()).toBe(true);

    const mockResponse = {
      suggestions: [
        {
          value: "ПАО СБЕРБАНК",
          data: {
            bic: "044525225",
            correspondent_account: "30101810400000000225",
            payment_city: "г. Москва",
            name: {
              payment: "ПАО СБЕРБАНК (ОТ ДАДАТА)",
            },
            address: {
              value: "117997, г Москва, ул Вавилова, д 19",
            },
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const bank = await lookupBankByBik("044525225");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/bank",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Token test-token-12345",
        }),
      })
    );

    expect(bank).not.toBeNull();
    expect(bank?.bankName).toBe("ПАО СБЕРБАНК (ОТ ДАДАТА)");
    expect(bank?.corrAccount).toBe("30101810400000000225");
    expect(bank?.source).toBe("dadata");
  });

  it("falls back to local catalog if DaData request fails", async () => {
    process.env.DADATA_API_KEY = "test-token-12345";

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const bank = await lookupBankByBik("044525225");
    expect(bank).not.toBeNull();
    expect(bank?.bankName).toBe("ПАО СБЕРБАНК");
    expect(bank?.source).toBe("catalog");
  });

  it("caches lookup results in memory", async () => {
    const sber1 = await lookupBankByBik("044525225");
    const sber2 = await lookupBankByBik("044525225");
    expect(sber1).toEqual(sber2);
  });
});
