import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  getCounterparties: vi.fn(),
  getCounterpartyById: vi.fn(),
  createCounterparty: vi.fn(),
  updateCounterparty: vi.fn(),
  deleteCounterparty: vi.fn(),
  getContracts: vi.fn(),
  getContractById: vi.fn(),
  createContract: vi.fn(),
  updateContract: vi.fn(),
  deleteContract: vi.fn(),
  getDeals: vi.fn(),
  getDealById: vi.fn(),
  createDeal: vi.fn(),
  updateDeal: vi.fn(),
  deleteDeal: vi.fn(),
  getSpecifications: vi.fn(),
  getSpecificationById: vi.fn(),
  createSpecification: vi.fn(),
  updateSpecification: vi.fn(),
  deleteSpecification: vi.fn(),
  getDocumentAttachments: vi.fn(),
  getDocumentAttachmentById: vi.fn(),
  createDocumentAttachment: vi.fn(),
  deleteDocumentAttachment: vi.fn(),
  getOrganizationProfile: vi.fn(),
  upsertOrganizationProfile: vi.fn(),
  getWaybills: vi.fn(),
  getWaybillById: vi.fn(),
  getWaybillDetails: vi.fn(),
  getLastCarrierData: vi.fn(),
  createWaybill: vi.fn(),
  updateWaybill: vi.fn(),
  closeWaybill: vi.fn(),
  deleteWaybill: vi.fn(),
  getDeletedRecords: vi.fn(),
  restoreDeletedRecord: vi.fn(),
  getDashboardStats: vi.fn(),
  getCounterpartyDocuments: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";

function createAuthContext(name = "manager-almaz"): TrpcContext {
  return {
    user: {
      id: 0,
      openId: name,
      name,
      email: null,
      loginMethod: "password",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createAnonymousContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("entity soft-delete & recycle bin API (all 4 entity types)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const cases = [
    {
      entityType: "deal" as const,
      title: "сделка",
      notFoundMessage: "Сделка не найдена или уже удалена",
      mockFn: () => dbMocks.deleteDeal,
      callDelete: (caller: ReturnType<typeof appRouter.createCaller>, id: number) =>
        caller.deals.delete({ id }),
    },
    {
      entityType: "specification" as const,
      title: "спецификация",
      notFoundMessage: "Спецификация не найдена или уже удалена",
      mockFn: () => dbMocks.deleteSpecification,
      callDelete: (caller: ReturnType<typeof appRouter.createCaller>, id: number) =>
        caller.specifications.delete({ id }),
    },
    {
      entityType: "contract" as const,
      title: "договор",
      notFoundMessage: "Договор не найден или уже удалён",
      mockFn: () => dbMocks.deleteContract,
      callDelete: (caller: ReturnType<typeof appRouter.createCaller>, id: number) =>
        caller.contracts.delete({ id }),
    },
    {
      entityType: "counterparty" as const,
      title: "контрагент",
      notFoundMessage: "Контрагент не найден или уже удалён",
      mockFn: () => dbMocks.deleteCounterparty,
      callDelete: (caller: ReturnType<typeof appRouter.createCaller>, id: number) =>
        caller.counterparties.delete({ id }),
    },
  ];

  for (const item of cases) {
    describe(`${item.entityType} (${item.title})`, () => {
      it("rejects anonymous delete requests with UNAUTHORIZED", async () => {
        const caller = appRouter.createCaller(createAnonymousContext());

        await expect(item.callDelete(caller, 15)).rejects.toMatchObject({
          code: "UNAUTHORIZED",
        });
        expect(item.mockFn()).not.toHaveBeenCalled();
      });

      it("rejects non-positive entity IDs with BAD_REQUEST", async () => {
        const caller = appRouter.createCaller(createAuthContext());

        await expect(item.callDelete(caller, 0)).rejects.toMatchObject({
          code: "BAD_REQUEST",
        });
        await expect(item.callDelete(caller, -3)).rejects.toMatchObject({
          code: "BAD_REQUEST",
        });
        expect(item.mockFn()).not.toHaveBeenCalled();
      });

      it("soft-deletes record with authenticated actor name and returns success", async () => {
        const caller = appRouter.createCaller(createAuthContext("ruslan-admin"));
        item.mockFn().mockResolvedValueOnce(undefined);

        const result = await item.callDelete(caller, 27);

        expect(item.mockFn()).toHaveBeenCalledTimes(1);
        expect(item.mockFn()).toHaveBeenCalledWith(27, "ruslan-admin");
        expect(result).toEqual({ success: true });
      });

      it("returns NOT_FOUND with readable message when record is missing or already deleted", async () => {
        const caller = appRouter.createCaller(createAuthContext());
        item.mockFn().mockRejectedValueOnce(new Error(item.notFoundMessage));

        await expect(item.callDelete(caller, 999)).rejects.toMatchObject({
          code: "NOT_FOUND",
          message: item.notFoundMessage,
        });
      });
    });
  }

  it("lists and restores all 4 soft-deleted entity types via recycleBin", async () => {
    const anonCaller = appRouter.createCaller(createAnonymousContext());
    await expect(anonCaller.recycleBin.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(anonCaller.recycleBin.restore({ entityType: "deal", id: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });

    const authCaller = appRouter.createCaller(createAuthContext("operator-1"));
    const now = new Date("2026-11-27T09:00:00.000Z");
    dbMocks.getDeletedRecords.mockResolvedValueOnce([
      { entityType: "deal", id: 10, label: "Сделка СД-2026/10", deletedAt: now },
      { entityType: "specification", id: 20, label: "Спецификация СП-10", deletedAt: now },
      { entityType: "contract", id: 30, label: "Договор Д-10", deletedAt: now },
      { entityType: "counterparty", id: 40, label: "ООО Поле", deletedAt: now },
    ]);

    const bin = await authCaller.recycleBin.list();
    expect(bin.map((r) => r.entityType)).toEqual(["deal", "specification", "contract", "counterparty"]);

    for (const entry of bin) {
      dbMocks.restoreDeletedRecord.mockResolvedValueOnce({ success: true });
      const res = await authCaller.recycleBin.restore({ entityType: entry.entityType, id: entry.id });
      expect(res).toEqual({ success: true });
      expect(dbMocks.restoreDeletedRecord).toHaveBeenCalledWith(entry.entityType, entry.id, "operator-1");
    }
  });
});
