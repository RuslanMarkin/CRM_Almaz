import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearPartyLookupCache, lookupPartyByInn } from "./partyLookupService";

describe("partyLookupService", () => {
  beforeEach(() => {
    clearPartyLookupCache();
    delete process.env.DADATA_API_KEY;
    delete process.env.DADATA_TOKEN;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearPartyLookupCache();
  });

  it("returns null for invalid or wrong-length INN", async () => {
    expect(await lookupPartyByInn("")).toBeNull();
    expect(await lookupPartyByInn("123456789")).toBeNull();
    expect(await lookupPartyByInn("12345678901")).toBeNull();
    expect(await lookupPartyByInn("1234567890123")).toBeNull();
    expect(await lookupPartyByInn("abcdefghij")).toBeNull();
  });

  it("resolves companies and sole traders from local catalog when DaData key is not set", async () => {
    const sber = await lookupPartyByInn("7707083893");
    expect(sber).not.toBeNull();
    expect(sber?.shortName).toBe("ПАО СБЕРБАНК");
    expect(sber?.type).toBe("legal");
    expect(sber?.kpp).toBe("773601001");
    expect(sber?.ogrn).toBe("1027700132195");
    expect(sber?.source).toBe("catalog");

    const almaz = await lookupPartyByInn("2371003651");
    expect(almaz).not.toBeNull();
    expect(almaz?.shortName).toBe("ООО «ТД «АЛМАЗ»");
    expect(almaz?.representativeName).toBe("Сайко Илья Сергеевич");
    expect(almaz?.source).toBe("catalog");

    const ip = await lookupPartyByInn("611186946109");
    expect(ip).not.toBeNull();
    expect(ip?.type).toBe("sole_trader");
    expect(ip?.shortName).toBe("ИП Шелковников А.А.");
    expect(ip?.ogrn).toBe("321619600220816");
    expect(ip?.source).toBe("catalog");

    const spaced = await lookupPartyByInn(" 7707 083 893 ");
    expect(spaced?.shortName).toBe("ПАО СБЕРБАНК");
  });

  it("calls DaData API for legal entities when DADATA_API_KEY is configured", async () => {
    process.env.DADATA_API_KEY = "test-token-12345";

    const mockResponse = {
      suggestions: [
        {
          value: "ООО «РОМАШКА»",
          unrestricted_value: "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «РОМАШКА»",
          data: {
            inn: "7700000000",
            kpp: "770001001",
            ogrn: "1027700000000",
            okpo: "12345678",
            okved: "46.21",
            type: "LEGAL",
            name: {
              full_with_opf: "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «РОМАШКА»",
              short_with_opf: "ООО «РОМАШКА»",
            },
            management: {
              name: "ИВАНОВ ИВАН ИВАНОВИЧ",
              post: "ГЕНЕРАЛЬНЫЙ ДИРЕКТОР",
            },
            address: {
              value: "г Москва, ул Примерная, д 1",
              unrestricted_value: "123456, г Москва, ул Примерная, д 1",
              data: {
                region_with_type: "г Москва",
              },
            },
            state: {
              status: "ACTIVE",
            },
            okveds: [
              {
                main: true,
                code: "46.21",
                name: "Торговля оптовая зерном",
              },
            ],
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const party = await lookupPartyByInn("7700000000");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Token test-token-12345",
        }),
      })
    );

    expect(party).not.toBeNull();
    expect(party?.name).toBe("ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «РОМАШКА»");
    expect(party?.shortName).toBe("ООО «РОМАШКА»");
    expect(party?.type).toBe("legal");
    expect(party?.kpp).toBe("770001001");
    expect(party?.ogrn).toBe("1027700000000");
    expect(party?.okpo).toBe("12345678");
    expect(party?.region).toBe("г Москва");
    expect(party?.legalAddress).toBe("123456, г Москва, ул Примерная, д 1");
    expect(party?.representativeName).toBe("Иванов Иван Иванович");
    expect(party?.representativePosition).toBe("Генеральный директор");
    expect(party?.authorityBasis).toBe("Устав");
    expect(party?.okvedName).toBe("Торговля оптовая зерном");
    expect(party?.source).toBe("dadata");
  });

  it("calls DaData API for sole traders (INDIVIDUAL) when DADATA_API_KEY is configured", async () => {
    process.env.DADATA_API_KEY = "test-token-12345";

    const mockResponse = {
      suggestions: [
        {
          value: "ИП Петров Петр Петрович",
          data: {
            inn: "610000000001",
            ogrn: "320610000000001",
            okpo: "0123456789",
            okved: "49.41",
            type: "INDIVIDUAL",
            name: {
              full_with_opf: "Индивидуальный предприниматель Петров Петр Петрович",
              short_with_opf: "ИП Петров Петр Петрович",
              full: "Петров Петр Петрович",
            },
            opf: {
              full: "Индивидуальный предприниматель",
            },
            fio: {
              surname: "Петров",
              name: "Петр",
              patronymic: "Петрович",
            },
            address: {
              unrestricted_value: "344000, Ростовская обл, г Ростов-на-Дону",
              data: {
                region_with_type: "Ростовская обл",
              },
            },
            state: {
              status: "ACTIVE",
            },
          },
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as any);

    const party = await lookupPartyByInn("610000000001");
    expect(party).not.toBeNull();
    expect(party?.type).toBe("sole_trader");
    expect(party?.kpp).toBe("");
    expect(party?.ogrn).toBe("320610000000001");
    expect(party?.representativeName).toBe("Петров Петр Петрович");
    expect(party?.representativePosition).toBe("Индивидуальный предприниматель");
    expect(party?.authorityBasis).toBe("Свидетельство ОГРНИП 320610000000001");
    expect(party?.source).toBe("dadata");
  });

  it("falls back to local catalog if DaData request fails", async () => {
    process.env.DADATA_API_KEY = "test-token-12345";

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));

    const sber = await lookupPartyByInn("7707083893");
    expect(sber).not.toBeNull();
    expect(sber?.shortName).toBe("ПАО СБЕРБАНК");
    expect(sber?.source).toBe("catalog");
  });

  it("falls back to free egrul.itsoft.ru for legal entity INN absent from local catalog", async () => {
    const mockEgrulResponse = {
      СвЮЛ: {
        "@attributes": {
          ИНН: "7704000001",
          КПП: "770401001",
          ОГРН: "1027700000001",
        },
        СвНаимЮЛ: {
          "@attributes": {
            НаимЮЛПолн: "ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «АГРО-ТЕСТ»",
          },
          СвНаимЮЛСокр: {
            "@attributes": {
              НаимСокр: "ООО «АГРО-ТЕСТ»",
            },
          },
        },
        СвАдресЮЛ: {
          СвАдрЮЛФИАС: {
            "@attributes": {
              Индекс: "119021",
            },
            НаимРегион: "г. Москва",
            ЭлУлДорСети: {
              "@attributes": {
                Тип: "ул.",
                Наим: "Тимура Фрунзе",
              },
            },
            Здание: {
              "@attributes": {
                Тип: "д.",
                Номер: "11",
              },
            },
          },
        },
        СведДолжнФЛ: {
          СвФЛ: {
            "@attributes": {
              Фамилия: "СИДОРОВ",
              Имя: "АЛЕКСЕЙ",
              Отчество: "ПЕТРОВИЧ",
            },
          },
          СвДолжн: {
            "@attributes": {
              НаимДолжн: "ГЕНЕРАЛЬНЫЙ ДИРЕКТОР",
            },
          },
        },
        СвОКВЭД: {
          СвОКВЭДОсн: {
            "@attributes": {
              КодОКВЭД: "46.21",
              НаимОКВЭД: "Торговля оптовая зерном",
            },
          },
        },
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockEgrulResponse,
    } as any);

    const party = await lookupPartyByInn("7704000001");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://egrul.itsoft.ru/7704000001.json",
      expect.objectContaining({ method: "GET" })
    );
    expect(party).not.toBeNull();
    expect(party?.type).toBe("legal");
    expect(party?.name).toBe("ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ «АГРО-ТЕСТ»");
    expect(party?.shortName).toBe("ООО «АГРО-ТЕСТ»");
    expect(party?.kpp).toBe("770401001");
    expect(party?.ogrn).toBe("1027700000001");
    expect(party?.region).toBe("г. Москва");
    expect(party?.legalAddress).toBe("119021, г. Москва, ул. Тимура Фрунзе, д. 11");
    expect(party?.representativeName).toBe("Сидоров Алексей Петрович");
    expect(party?.representativePosition).toBe("Генеральный директор");
    expect(party?.okved).toBe("46.21");
    expect(party?.okvedName).toBe("Торговля оптовая зерном");
    expect(party?.status).toBe("ACTIVE");
    expect(party?.source).toBe("egrul");
  });

  it("falls back to free egrul.itsoft.ru for sole trader INN absent from local catalog", async () => {
    const mockEgripResponse = {
      СвИП: {
        "@attributes": {
          ИННФЛ: "230100000001",
          ОГРНИП: "321230000000001",
          НаимВидИП: "Индивидуальный предприниматель",
        },
        СвФЛ: {
          ФИОРус: {
            "@attributes": {
              Фамилия: "КОЗЛОВ",
              Имя: "ДМИТРИЙ",
              Отчество: "СЕРГЕЕВИЧ",
            },
          },
        },
        СвАдрМЖ: {
          АдресРФ: {
            Регион: {
              "@attributes": {
                ТипРегион: "КРАЙ",
                НаимРегион: "КРАСНОДАРСКИЙ",
              },
            },
            Город: {
              "@attributes": {
                ТипГород: "Г",
                НаимГород: "КРАСНОДАР",
              },
            },
          },
        },
        СвОКВЭД: {
          СвОКВЭДОсн: {
            "@attributes": {
              КодОКВЭД: "49.41",
              НаимОКВЭД: "Деятельность автомобильного грузового транспорта",
            },
          },
        },
      },
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => mockEgripResponse,
    } as any);

    const party = await lookupPartyByInn("230100000001");
    expect(party).not.toBeNull();
    expect(party?.type).toBe("sole_trader");
    expect(party?.name).toBe("Индивидуальный предприниматель Козлов Дмитрий Сергеевич");
    expect(party?.shortName).toBe("ИП Козлов Д.С.");
    expect(party?.ogrn).toBe("321230000000001");
    expect(party?.representativeName).toBe("Козлов Дмитрий Сергеевич");
    expect(party?.authorityBasis).toBe("Свидетельство ОГРНИП 321230000000001");
    expect(party?.region).toBe("КРАЙ КРАСНОДАРСКИЙ");
    expect(party?.source).toBe("egrul");
  });

  it("caches lookup results in memory", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        СвЮЛ: {
          "@attributes": { ИНН: "7704000002", КПП: "770401001", ОГРН: "1027700000002" },
          СвНаимЮЛ: { "@attributes": { НаимЮЛПолн: "ООО КЭШ", НаимЮЛСокр: "ООО КЭШ" } },
        },
      }),
    } as any);

    const first = await lookupPartyByInn("7704000002");
    const second = await lookupPartyByInn("7704000002");
    expect(first).toEqual(second);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
