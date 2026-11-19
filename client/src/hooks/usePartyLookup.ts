import { useCallback, useRef, useState } from "react";

export interface PartyLookupResult {
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

export function usePartyLookup() {
  const [loading, setLoading] = useState(false);
  const [partyInfo, setPartyInfo] = useState<PartyLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const lookup = useCallback(async (rawInn: string): Promise<PartyLookupResult | null> => {
    const inn = (rawInn || "").replace(/\D/g, "").trim();
    if (inn.length !== 10 && inn.length !== 12) {
      requestIdRef.current += 1;
      setPartyInfo(null);
      setError(null);
      setLoading(false);
      return null;
    }

    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/party/${inn}`);
      if (requestIdRef.current !== requestId) {
        return null;
      }

      if (!res.ok) {
        if (res.status === 404) {
          setError("Организация не найдена по указанному ИНН");
        } else {
          setError("Не удалось получить данные организации");
        }
        setPartyInfo(null);
        return null;
      }

      const data: PartyLookupResult = await res.json();
      if (requestIdRef.current !== requestId) {
        return null;
      }

      setPartyInfo(data);
      setError(null);
      return data;
    } catch {
      if (requestIdRef.current === requestId) {
        setError("Ошибка сети при запросе организации");
      }
      return null;
    } finally {
      if (requestIdRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  const reset = useCallback(() => {
    requestIdRef.current += 1;
    setPartyInfo(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    lookup,
    loading,
    partyInfo,
    error,
    reset,
  };
}
