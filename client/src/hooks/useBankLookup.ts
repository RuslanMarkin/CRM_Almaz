import { useCallback, useState } from "react";

export interface BankLookupResult {
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

export function useBankLookup() {
  const [loading, setLoading] = useState(false);
  const [bankInfo, setBankInfo] = useState<BankLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (rawBik: string): Promise<BankLookupResult | null> => {
    const bik = (rawBik || "").replace(/\D/g, "").trim();
    if (bik.length !== 9) {
      setBankInfo(null);
      setError(null);
      return null;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bank/${bik}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Банк не найден по указанному БИК");
        } else {
          setError("Не удалось получить данные банка");
        }
        setBankInfo(null);
        return null;
      }
      const data: BankLookupResult = await res.json();
      setBankInfo(data);
      setError(null);
      return data;
    } catch {
      setError("Ошибка сети при запросе банка");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setBankInfo(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    lookup,
    loading,
    bankInfo,
    error,
    reset,
  };
}
