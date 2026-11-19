import { RUSSIAN_PARTIES_CATALOG } from "./russianPartiesCatalog";

export interface PartyLookupDetails {
  inn: string;
  name: string;
  shortName: string;
  type: "legal" | "sole_trader";
  kpp?: string;
  ogrn?: string;
  okpo?: string;
  legalAddress?: string;
  region?: string;
  representativeName?: string;
  representativePosition?: string;
  authorityBasis?: string;
  okved?: string;
  okvedName?: string;
  status?: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "BANKRUPT" | "REORGANIZING";
  source: "dadata" | "egrul" | "catalog";
}

interface CacheEntry {
  data: PartyLookupDetails | null;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_SUCCESS_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL_MISS_MS = 5 * 60 * 1000; // 5 minutes

export function clearPartyLookupCache(): void {
  memoryCache.clear();
}

function getDaDataToken(): string {
  return (process.env.DADATA_API_KEY || process.env.DADATA_TOKEN || "").trim();
}

function formatTitleWord(word: string): string {
  if (!word) return "";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function formatPersonName(raw?: string | null): string {
  const cleaned = (raw || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((part) => part.split("-").map(formatTitleWord).join("-"))
    .join(" ");
}

function formatPosition(raw?: string | null): string {
  const cleaned = (raw || "").trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  // If all uppercase (typical for EGRUL/DaData), convert to sentence case
  const isAllUpper = cleaned === cleaned.toUpperCase() && cleaned !== cleaned.toLowerCase();
  const normalized = isAllUpper
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase()
    : cleaned;
  return normalized.slice(0, 128);
}

function extractRegionFromAddress(address?: string | null): string {
  const cleaned = (address || "").trim();
  if (!cleaned) return "";
  const parts = cleaned.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    if (/^\d{6}$/.test(part)) continue;
    if (/^(россия|рф)$/i.test(part)) continue;
    if (
      /(край|область|обл\.|республика|респ\.|округ|ао|г\.\s*москва|москва|г\.\s*санкт-петербург|санкт-петербург|г\.\s*севастополь|севастополь)/i.test(
        part
      )
    ) {
      return part;
    }
    return part;
  }
  return "";
}

function firstItem<T>(value: T | T[] | undefined | null): T | undefined {
  if (!value) return undefined;
  return Array.isArray(value) ? value[0] : value;
}

function attr(node: unknown, key: string): string {
  if (!node || typeof node !== "object") return "";
  const obj = node as Record<string, unknown>;
  const attrs = obj["@attributes"];
  if (attrs && typeof attrs === "object") {
    const val = (attrs as Record<string, unknown>)[key];
    if (typeof val === "string" || typeof val === "number") {
      return String(val).trim();
    }
  }
  const direct = obj[key];
  if (typeof direct === "string" || typeof direct === "number") {
    return String(direct).trim();
  }
  return "";
}

function textValue(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node).trim();
  }
  if (!node || typeof node !== "object") return "";
  const obj = node as Record<string, unknown>;
  for (const key of ["#text", "text", "value", "Наим", "НаимРегион"]) {
    const val = obj[key];
    if (typeof val === "string" || typeof val === "number") {
      return String(val).trim();
    }
  }
  return attr(obj, "Наим") || attr(obj, "НаимРегион");
}

function formatTypeAndName(typePart?: string, namePart?: string): string {
  const t = (typePart || "").trim();
  const n = (namePart || "").trim();
  if (!n) return "";
  if (!t) return n;
  if (n.toLowerCase().startsWith(t.toLowerCase())) return n;
  return `${t} ${n}`;
}

function parseKladrAddress(addrNode: unknown): { address: string; region: string } {
  if (!addrNode || typeof addrNode !== "object") return { address: "", region: "" };
  const obj = addrNode as Record<string, unknown>;
  const index = attr(obj, "Индекс");
  const regionType = attr(obj.Регион, "ТипРегион");
  const regionName = attr(obj.Регион, "НаимРегион");
  const region = formatTypeAndName(regionType, regionName);

  const district = formatTypeAndName(attr(obj.Район, "ТипРайон"), attr(obj.Район, "НаимРайон"));
  const city = formatTypeAndName(attr(obj.Город, "ТипГород"), attr(obj.Город, "НаимГород"));
  const settlement = formatTypeAndName(
    attr(obj.НаселПункт, "ТипНаселПункт"),
    attr(obj.НаселПункт, "НаимНаселПункт")
  );
  const street = formatTypeAndName(attr(obj.Улица, "ТипУлица"), attr(obj.Улица, "НаимУлица"));

  const house = attr(obj, "Дом");
  const building = attr(obj, "Корпус");
  const flat = attr(obj, "Кварт");

  const parts = [
    index,
    region,
    district,
    city && city.toLowerCase() !== region.toLowerCase() ? city : "",
    settlement,
    street,
    house ? (house.toLowerCase().startsWith("д") ? house : `д. ${house}`) : "",
    building ? (building.toLowerCase().startsWith("к") ? building : `к. ${building}`) : "",
    flat ? flat : "",
  ].filter(Boolean);

  return {
    address: parts.join(", "),
    region,
  };
}

function parseFiasAddress(addrNode: unknown): { address: string; region: string } {
  if (!addrNode || typeof addrNode !== "object") return { address: "", region: "" };
  const obj = addrNode as Record<string, unknown>;
  const index = attr(obj, "Индекс");
  const region = textValue(obj.НаимРегион) || textValue(obj.Регион);

  const district = formatTypeAndName(
    attr(obj.МуниципРайон, "ВидКод") === "1" ? "р-н" : "",
    attr(obj.МуниципРайон, "Наим")
  );
  const citySettlement = formatTypeAndName(
    attr(obj.ГородСелПоселение, "Вид"),
    attr(obj.ГородСелПоселение, "Наим")
  );
  const locality = formatTypeAndName(attr(obj.НаселенПункт, "Вид"), attr(obj.НаселенПункт, "Наим"));
  const street = formatTypeAndName(attr(obj.ЭлУлДорСети, "Тип"), attr(obj.ЭлУлДорСети, "Наим"));
  const building = formatTypeAndName(attr(obj.Здание, "Тип"), attr(obj.Здание, "Номер"));
  const room = formatTypeAndName(attr(obj.ПомещЗдания, "Тип"), attr(obj.ПомещЗдания, "Номер"));
  const flat = formatTypeAndName(attr(obj.ПомещКварт, "Тип"), attr(obj.ПомещКварт, "Номер"));

  const parts = [
    index,
    region,
    district,
    citySettlement,
    locality,
    street,
    building,
    room,
    flat,
  ].filter(Boolean);

  return {
    address: parts.join(", "),
    region,
  };
}

function parseEgrulAddress(svAddress: unknown): { address: string; region: string } {
  if (!svAddress || typeof svAddress !== "object") return { address: "", region: "" };
  const obj = svAddress as Record<string, unknown>;
  if (obj.СвАдрЮЛФИАС) {
    const fias = parseFiasAddress(obj.СвАдрЮЛФИАС);
    if (fias.address) return fias;
  }
  if (obj.АдресРФ) {
    const kladr = parseKladrAddress(obj.АдресРФ);
    if (kladr.address) return kladr;
  }
  const fallback = parseKladrAddress(obj);
  if (fallback.address) return fallback;
  return { address: "", region: "" };
}

function parseEgrulJson(inn: string, json: unknown): PartyLookupDetails | null {
  if (!json || typeof json !== "object") return null;
  const root = json as Record<string, unknown>;

  const svUl = (root.СвЮЛ ?? (root.EGRUL as Record<string, unknown> | undefined)?.СвЮЛ) as
    | Record<string, unknown>
    | undefined;

  if (svUl && typeof svUl === "object") {
    const nameBlock = (svUl.СвНаимЮЛ ?? {}) as Record<string, unknown>;
    const fullName =
      attr(nameBlock, "НаимЮЛПолн") ||
      attr(nameBlock.СвНаимЮЛСокр, "НаимСокр") ||
      attr(nameBlock, "НаимЮЛСокр");
    const shortName =
      attr(nameBlock.СвНаимЮЛСокр, "НаимСокр") ||
      attr(nameBlock, "НаимЮЛСокр") ||
      fullName;

    if (!fullName && !shortName) return null;

    const ogrn = attr(svUl, "ОГРН");
    const kpp = attr(svUl, "КПП");
    const { address, region } = parseEgrulAddress(svUl.СвАдресЮЛ);

    const mgmt = firstItem(svUl.СведДолжнФЛ as Record<string, unknown> | Record<string, unknown>[] | undefined);
    const mgmtFl = mgmt?.СвФЛ;
    const rawDirector = [
      attr(mgmtFl, "Фамилия"),
      attr(mgmtFl, "Имя"),
      attr(mgmtFl, "Отчество"),
    ]
      .filter(Boolean)
      .join(" ");
    const representativeName = formatPersonName(rawDirector);
    const representativePosition = formatPosition(attr(mgmt?.СвДолжн, "НаимДолжн")) || "Генеральный директор";

    const mainOkved = firstItem(
      (svUl.СвОКВЭД as Record<string, unknown> | undefined)?.СвОКВЭДОсн as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined
    );
    const okved = attr(mainOkved, "КодОКВЭД");
    const okvedName = attr(mainOkved, "НаимОКВЭД");

    const status: PartyLookupDetails["status"] = svUl.СвПрекрЮЛ ? "LIQUIDATED" : "ACTIVE";

    return {
      inn: attr(svUl, "ИНН") || inn,
      name: fullName || shortName,
      shortName: shortName || fullName,
      type: "legal",
      kpp: kpp || undefined,
      ogrn: ogrn || undefined,
      legalAddress: address || undefined,
      region: region || extractRegionFromAddress(address) || undefined,
      representativeName: representativeName || undefined,
      representativePosition: representativePosition || undefined,
      authorityBasis: "Устав",
      okved: okved || undefined,
      okvedName: okvedName || undefined,
      status,
      source: "egrul",
    };
  }

  const svIp = (root.СвИП ?? (root.EGRIP as Record<string, unknown> | undefined)?.СвИП) as
    | Record<string, unknown>
    | undefined;

  if (svIp && typeof svIp === "object") {
    const svFl = (svIp.СвФЛ ?? {}) as Record<string, unknown>;
    const fioNode = svFl.ФИОРус ?? svFl.СвФИО ?? svIp.СвФИО;
    const surname = formatPersonName(attr(fioNode, "Фамилия"));
    const firstName = formatPersonName(attr(fioNode, "Имя"));
    const patronymic = formatPersonName(attr(fioNode, "Отчество"));
    const fio = [surname, firstName, patronymic].filter(Boolean).join(" ");
    if (!fio) return null;

    const kindName = attr(svIp, "НаимВидИП");
    const prefix = /глава/i.test(kindName)
      ? "Индивидуальный предприниматель Глава крестьянского (фермерского) хозяйства"
      : "Индивидуальный предприниматель";
    const fullName = `${prefix} ${fio}`;
    const initials = [firstName ? `${firstName.charAt(0)}.` : "", patronymic ? `${patronymic.charAt(0)}.` : ""]
      .filter(Boolean)
      .join("");
    const shortName = surname && initials ? `ИП ${surname} ${initials}` : `ИП ${fio}`;

    const ogrn = attr(svIp, "ОГРНИП");
    const { address, region } = parseEgrulAddress(svIp.СвАдрМЖ ?? svIp.СвАдрес);

    const mainOkved = firstItem(
      (svIp.СвОКВЭД as Record<string, unknown> | undefined)?.СвОКВЭДОсн as
        | Record<string, unknown>
        | Record<string, unknown>[]
        | undefined
    );
    const okved = attr(mainOkved, "КодОКВЭД");
    const okvedName = attr(mainOkved, "НаимОКВЭД");
    const status: PartyLookupDetails["status"] = svIp.СвПрекр || svIp.СвПрекрИП ? "LIQUIDATED" : "ACTIVE";

    return {
      inn: attr(svIp, "ИННФЛ") || inn,
      name: fullName,
      shortName,
      type: "sole_trader",
      ogrn: ogrn || undefined,
      legalAddress: address || undefined,
      region: region || extractRegionFromAddress(address) || undefined,
      representativeName: fio,
      representativePosition: formatPosition(kindName) || "Индивидуальный предприниматель",
      authorityBasis: ogrn ? `Свидетельство ОГРНИП ${ogrn}` : "Свидетельство о государственной регистрации ИП",
      okved: okved || undefined,
      okvedName: okvedName || undefined,
      status,
      source: "egrul",
    };
  }

  return null;
}

export async function lookupPartyByInn(rawInn: string): Promise<PartyLookupDetails | null> {
  const inn = (rawInn || "").replace(/\D/g, "").trim();

  if (!/^(\d{10}|\d{12})$/.test(inn)) {
    return null;
  }

  const cached = memoryCache.get(inn);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const token = getDaDataToken();

  // 1. Try DaData API if token is configured
  if (token) {
    try {
      const response = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Token ${token}`,
        },
        body: JSON.stringify({ query: inn, count: 1 }),
        signal: AbortSignal.timeout(4000),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          suggestions?: Array<{
            value?: string;
            unrestricted_value?: string;
            data?: {
              inn?: string;
              kpp?: string;
              ogrn?: string;
              okpo?: string;
              okved?: string;
              type?: "LEGAL" | "INDIVIDUAL";
              name?: {
                full_with_opf?: string;
                short_with_opf?: string;
                full?: string;
                short?: string;
              };
              opf?: {
                short?: string;
                full?: string;
              };
              fio?: {
                surname?: string;
                name?: string;
                patronymic?: string;
              };
              management?: {
                name?: string;
                post?: string;
              };
              address?: {
                value?: string;
                unrestricted_value?: string;
                data?: {
                  region_with_type?: string;
                };
              };
              state?: {
                status?: "ACTIVE" | "LIQUIDATING" | "LIQUIDATED" | "BANKRUPT" | "REORGANIZING";
              };
              okveds?: Array<{
                main?: boolean;
                code?: string;
                name?: string;
              }>;
            };
          }>;
        };

        const suggestion = json.suggestions?.[0];
        if (suggestion) {
          const d = suggestion.data ?? {};
          const type: "legal" | "sole_trader" =
            d.type === "INDIVIDUAL" || inn.length === 12 ? "sole_trader" : "legal";

          const name =
            d.name?.full_with_opf ||
            suggestion.unrestricted_value ||
            suggestion.value ||
            d.name?.full ||
            "";
          const shortName =
            d.name?.short_with_opf ||
            suggestion.value ||
            d.name?.short ||
            d.name?.full ||
            name;

          const legalAddress = d.address?.unrestricted_value || d.address?.value || "";
          const region = d.address?.data?.region_with_type || extractRegionFromAddress(legalAddress);

          const representativeName =
            type === "legal"
              ? formatPersonName(d.management?.name)
              : formatPersonName(
                  d.fio
                    ? [d.fio.surname, d.fio.name, d.fio.patronymic].filter(Boolean).join(" ")
                    : d.name?.full
                );

          const representativePosition =
            type === "legal"
              ? formatPosition(d.management?.post) || "Генеральный директор"
              : d.opf?.full
                ? formatPosition(d.opf.full)
                : "Индивидуальный предприниматель";

          const authorityBasis =
            type === "legal"
              ? "Устав"
              : d.ogrn
                ? `Свидетельство ОГРНИП ${d.ogrn}`
                : "Свидетельство о государственной регистрации ИП";

          const mainOkvedObj = d.okveds?.find((item) => item.main);

          const result: PartyLookupDetails = {
            inn: d.inn || inn,
            name,
            shortName,
            type,
            kpp: type === "legal" ? d.kpp || "" : "",
            ogrn: d.ogrn || "",
            okpo: d.okpo || "",
            legalAddress,
            region,
            representativeName,
            representativePosition,
            authorityBasis,
            okved: d.okved || mainOkvedObj?.code || "",
            okvedName: mainOkvedObj?.name || "",
            status: d.state?.status,
            source: "dadata",
          };

          memoryCache.set(inn, {
            data: result,
            expiresAt: Date.now() + CACHE_TTL_SUCCESS_MS,
          });

          return result;
        }
      } else {
        const errorText = await response.text().catch(() => "");
        console.warn(`[partyLookup] DaData API returned status ${response.status}: ${errorText.slice(0, 150)}`);
      }
    } catch (err: unknown) {
      console.warn(`[partyLookup] DaData API query failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Fallback to built-in catalog
  const catalogItem = RUSSIAN_PARTIES_CATALOG[inn];
  if (catalogItem) {
    const result: PartyLookupDetails = {
      ...catalogItem,
      status: "ACTIVE",
      source: "catalog",
    };

    memoryCache.set(inn, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_SUCCESS_MS,
    });

    return result;
  }

  // 3. Fallback to free public EGRUL/EGRIP mirror (egrul.itsoft.ru, no API key required)
  try {
    const response = await fetch(`https://egrul.itsoft.ru/${inn}.json`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(4000),
    });

    if (response.ok) {
      const json = await response.json();
      const parsed = parseEgrulJson(inn, json);
      if (parsed) {
        memoryCache.set(inn, {
          data: parsed,
          expiresAt: Date.now() + CACHE_TTL_SUCCESS_MS,
        });
        return parsed;
      }
    } else {
      console.warn(`[partyLookup] egrul.itsoft.ru returned status ${response.status} for INN ${inn}`);
    }
  } catch (err: unknown) {
    console.warn(`[partyLookup] egrul.itsoft.ru query failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. Not found
  memoryCache.set(inn, {
    data: null,
    expiresAt: Date.now() + CACHE_TTL_MISS_MS,
  });

  return null;
}
