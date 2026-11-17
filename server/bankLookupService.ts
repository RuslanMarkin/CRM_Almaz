import { RUSSIAN_BANKS_CATALOG } from "./russianBanksCatalog";

export interface BankLookupDetails {
  bik: string;
  bankName: string;
  corrAccount: string;
  city?: string;
  address?: string;
  inn?: string;
  kpp?: string;
  swift?: string;
  source: "dadata" | "catalog";
}

interface CacheEntry {
  data: BankLookupDetails | null;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_SUCCESS_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL_MISS_MS = 5 * 60 * 1000; // 5 minutes

export function clearBankLookupCache(): void {
  memoryCache.clear();
}

export function isDaDataConfigured(): boolean {
  const token = (process.env.DADATA_API_KEY || process.env.DADATA_TOKEN || "").trim();
  return token.length > 0;
}

export async function lookupBankByBik(rawBik: string): Promise<BankLookupDetails | null> {
  const bik = (rawBik || "").replace(/\D/g, "").trim();

  if (!/^\d{9}$/.test(bik)) {
    return null;
  }

  const cached = memoryCache.get(bik);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const token = (process.env.DADATA_API_KEY || process.env.DADATA_TOKEN || "").trim();

  // 1. Try DaData API if token is configured
  if (token) {
    try {
      const response = await fetch("https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/bank", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Token ${token}`,
        },
        body: JSON.stringify({ query: bik, count: 1 }),
        signal: AbortSignal.timeout(4000),
      });

      if (response.ok) {
        const json = (await response.json()) as {
          suggestions?: Array<{
            value?: string;
            data?: {
              bic?: string;
              correspondent_account?: string;
              payment_city?: string;
              inn?: string;
              kpp?: string;
              swift?: string;
              name?: {
                payment?: string;
                short?: string;
                full?: string;
              };
              address?: {
                value?: string;
                data?: {
                  city?: string;
                };
              };
            };
          }>;
        };

        const suggestion = json.suggestions?.[0];
        if (suggestion) {
          const d = suggestion.data ?? {};
          const bankName =
            d.name?.payment ||
            d.name?.short ||
            suggestion.value ||
            d.name?.full ||
            "";

          const result: BankLookupDetails = {
            bik: d.bic || bik,
            bankName,
            corrAccount: d.correspondent_account || "",
            city: d.payment_city || d.address?.data?.city || "",
            address: d.address?.value || "",
            inn: d.inn || "",
            kpp: d.kpp || "",
            swift: d.swift || "",
            source: "dadata",
          };

          memoryCache.set(bik, {
            data: result,
            expiresAt: Date.now() + CACHE_TTL_SUCCESS_MS,
          });

          return result;
        }
      } else {
        const errorText = await response.text().catch(() => "");
        console.warn(`[bankLookup] DaData API returned status ${response.status}: ${errorText.slice(0, 150)}`);
      }
    } catch (err: unknown) {
      console.warn(`[bankLookup] DaData API query failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2. Fallback to built-in catalog
  const catalogItem = RUSSIAN_BANKS_CATALOG[bik];
  if (catalogItem) {
    const result: BankLookupDetails = {
      bik: catalogItem.bik,
      bankName: catalogItem.name,
      corrAccount: catalogItem.corrAccount,
      city: catalogItem.city,
      address: catalogItem.address || "",
      inn: catalogItem.inn || "",
      source: "catalog",
    };

    memoryCache.set(bik, {
      data: result,
      expiresAt: Date.now() + CACHE_TTL_SUCCESS_MS,
    });

    return result;
  }

  // 3. Not found
  memoryCache.set(bik, {
    data: null,
    expiresAt: Date.now() + CACHE_TTL_MISS_MS,
  });

  return null;
}
