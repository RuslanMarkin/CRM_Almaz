import { describe, expect, it } from "vitest";

import {
  COUNTERPARTY_STATUSES,
  COUNTERPARTY_STATUS_VALUES,
  counterpartyStatusInputSchema,
  counterpartyStatusSchema,
} from "./counterpartyStatus";

describe("статусы контрагентов", () => {
  it("содержат все согласованные коды и понятные подписи", () => {
    expect(COUNTERPARTY_STATUS_VALUES).toEqual([
      "normal",
      "missing_scans",
      "blacklisted",
      "debtor",
    ]);
    expect(COUNTERPARTY_STATUSES.blacklisted.label).toBe("ЧС");
  });

  it("не принимает неизвестный статус", () => {
    expect(counterpartyStatusSchema.safeParse("unknown").success).toBe(false);
  });

  it("назначает статус «Норм» при отсутствии значения", () => {
    expect(counterpartyStatusInputSchema.parse(undefined)).toBe("normal");
  });
});
