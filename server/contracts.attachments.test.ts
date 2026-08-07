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
  createDocumentAttachment: vi.fn(),
  deleteDocumentAttachment: vi.fn(),
  getWaybills: vi.fn(),
  getWaybillById: vi.fn(),
  getWaybillDetails: vi.fn(),
  getLastCarrierData: vi.fn(),
  createWaybill: vi.fn(),
  updateWaybill: vi.fn(),
  closeWaybill: vi.fn(),
  deleteWaybill: vi.fn(),
  getDashboardStats: vi.fn(),
  getCounterpartyDocuments: vi.fn(),
}));

vi.mock("./db", () => dbMocks);

import { appRouter } from "./routers";

function createContext(): TrpcContext {
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

describe("contracts API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes contract creation data with the selected counterparty link", async () => {
    const caller = appRouter.createCaller(createContext());
    dbMocks.getCounterpartyById.mockResolvedValue({ id: 7, businessRole: "seller" });

    await caller.contracts.create({
      number: "Д-42",
      counterpartyId: 7,
      contractKind: "purchase",
      type: "framework",
      subject: "Поставка зерна",
      amount: "125000.50",
      currency: "RUB",
      status: "active",
    });

    expect(dbMocks.createContract).toHaveBeenCalledWith({
      number: "Д-42",
      counterpartyId: 7,
      contractKind: "purchase",
      type: "framework",
      subject: "Поставка зерна",
      amount: "125000.50",
      currency: "RUB",
      status: "active",
    });
  });

  it("rejects contract creation without a counterparty", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.contracts.create({
        number: "Д-43",
      counterpartyId: 0,
      contractKind: "purchase",
        type: "framework",
        currency: "RUB",
        status: "draft",
      }),
    ).rejects.toThrow();

    expect(dbMocks.createContract).not.toHaveBeenCalled();
  });
});

describe("deals API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a deal only with seller and buyer roles", async () => {
    const caller = appRouter.createCaller(createContext());
    dbMocks.getCounterpartyById
      .mockResolvedValueOnce({ id: 11, businessRole: "seller" })
      .mockResolvedValueOnce({ id: 12, businessRole: "buyer" });
    dbMocks.createDeal.mockResolvedValue({ id: 8, number: "СД-0008" });

    await caller.deals.create({
      number: "СД-0008",
      sellerId: 11,
      buyerId: 12,
      cargoName: "Пшеница",
      plannedVolume: "300",
      status: "planning",
      currency: "RUB",
    });

    expect(dbMocks.createDeal).toHaveBeenCalledWith({
      number: "СД-0008",
      sellerId: 11,
      buyerId: 12,
      cargoName: "Пшеница",
      plannedVolume: "300",
      status: "planning",
      currency: "RUB",
    });
  });

  it("rejects a buyer selected as the seller", async () => {
    const caller = appRouter.createCaller(createContext());
    dbMocks.getCounterpartyById.mockResolvedValue({ id: 11, businessRole: "buyer" });

    await expect(caller.deals.create({
      number: "СД-0009",
      sellerId: 11,
      buyerId: 12,
      cargoName: "Пшеница",
      status: "planning",
      currency: "RUB",
    })).rejects.toThrow("продавец");

    expect(dbMocks.createDeal).not.toHaveBeenCalled();
  });
});

describe("document attachments API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores contract scan metadata and owner link", async () => {
    const caller = appRouter.createCaller(createContext());
    dbMocks.createDocumentAttachment.mockResolvedValue({
      id: 10,
      entityType: "contract",
      entityId: 7,
      documentKind: "contract_scan",
      fileName: "contract.pdf",
      contentType: "application/pdf",
      size: 2048,
      dataUrl: "data:application/pdf;base64,JVBERi0x",
    });

    await caller.attachments.create({
      entityType: "contract",
      entityId: 7,
      documentKind: "contract_scan",
      fileName: "contract.pdf",
      contentType: "application/pdf",
      size: 2048,
      dataUrl: "data:application/pdf;base64,JVBERi0x",
    });

    expect(dbMocks.createDocumentAttachment).toHaveBeenCalledWith({
      entityType: "contract",
      entityId: 7,
      documentKind: "contract_scan",
      fileName: "contract.pdf",
      contentType: "application/pdf",
      size: 2048,
      dataUrl: "data:application/pdf;base64,JVBERi0x",
    });
  });

  it("stores specification scan metadata and owner link", async () => {
    const caller = appRouter.createCaller(createContext());

    await caller.attachments.create({
      entityType: "contract",
      entityId: 7,
      documentKind: "specification_scan",
      specificationId: 12,
      fileName: "specification.png",
      contentType: "image/png",
      size: 4096,
      dataUrl: "data:image/png;base64,iVBORw0KGgo",
    });

    expect(dbMocks.createDocumentAttachment).toHaveBeenCalledWith({
      entityType: "contract",
      entityId: 7,
      documentKind: "specification_scan",
      specificationId: 12,
      fileName: "specification.png",
      contentType: "image/png",
      size: 4096,
      dataUrl: "data:image/png;base64,iVBORw0KGgo",
    });
  });

  it("keeps a specification scan in its parent contract", async () => {
    const caller = appRouter.createCaller(createContext());

    await caller.attachments.create({
      entityType: "contract",
      entityId: 19,
      documentKind: "specification_scan",
      specificationId: 21,
      fileName: "requisites.pdf",
      contentType: "application/pdf",
      size: 3072,
      dataUrl: "data:application/pdf;base64,JVBERi0x",
    });

    expect(dbMocks.createDocumentAttachment).toHaveBeenCalledWith({
      entityType: "contract",
      entityId: 19,
      documentKind: "specification_scan",
      specificationId: 21,
      fileName: "requisites.pdf",
      contentType: "application/pdf",
      size: 3072,
      dataUrl: "data:application/pdf;base64,JVBERi0x",
    });
  });

  it("stores a statutory document in the selected counterparty archive", async () => {
    const caller = appRouter.createCaller(createContext());

    await caller.attachments.create({
      entityType: "counterparty",
      entityId: 19,
      documentKind: "statutory_document",
      fileName: "egrul.pdf",
      contentType: "application/pdf",
      size: 3072,
      dataUrl: "data:application/pdf;base64,JVBERi0x",
    });

    expect(dbMocks.createDocumentAttachment).toHaveBeenCalledWith({
      entityType: "counterparty",
      entityId: 19,
      documentKind: "statutory_document",
      fileName: "egrul.pdf",
      contentType: "application/pdf",
      size: 3072,
      dataUrl: "data:application/pdf;base64,JVBERi0x",
    });
  });

  it("rejects oversized scan uploads before storage", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.attachments.create({
        entityType: "contract",
        entityId: 7,
        fileName: "too-large.pdf",
        contentType: "application/pdf",
        size: 15 * 1024 * 1024 + 1,
        dataUrl: "data:application/pdf;base64,JVBERi0x",
      }),
    ).rejects.toThrow();

    expect(dbMocks.createDocumentAttachment).not.toHaveBeenCalled();
  });

  it("rejects attachments without a valid owner", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(
      caller.attachments.create({
        entityType: "contract",
        entityId: 0,
        fileName: "contract.pdf",
        contentType: "application/pdf",
        size: 2048,
        dataUrl: "data:application/pdf;base64,JVBERi0x",
      }),
    ).rejects.toThrow();

    expect(dbMocks.createDocumentAttachment).not.toHaveBeenCalled();
  });
});

describe("waybill formation validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects forming an incomplete draft with a visible error list", async () => {
    const caller = appRouter.createCaller(createContext());
    dbMocks.getWaybillById.mockResolvedValue({
      id: 1,
      number: "2026-001",
      contractId: null,
      specificationId: null,
      supplierName: "",
      buyerName: "Покупатель",
      carrierName: "",
      loadingAddress: "",
      unloadingAddress: "Элеватор",
      cargoName: "",
      quantity: null,
      driverName: "",
      tractorNumber: "",
      status: "draft",
    });

    await expect(caller.waybills.updateStatus({ id: 1, status: "in_transit" })).rejects.toThrow(
      /Нельзя сформировать ТТН/,
    );
    await expect(caller.waybills.updateStatus({ id: 1, status: "in_transit" })).rejects.toThrow(
      /выберите договор/,
    );

    expect(dbMocks.updateWaybill).not.toHaveBeenCalled();
  });

  it("allows forming a draft when required fields are present", async () => {
    const caller = appRouter.createCaller(createContext());
    dbMocks.getWaybillById.mockResolvedValue({
      id: 1,
      number: "2026-001",
      contractId: 3,
      specificationId: 5,
      supplierName: "Поставщик",
      buyerName: "Покупатель",
      carrierName: "Перевозчик",
      loadingAddress: "Склад поставщика",
      unloadingAddress: "Элеватор",
      cargoName: "Пшеница",
      quantity: "20.500",
      driverName: "Иванов И.И.",
      tractorNumber: "А123ВС777",
      status: "draft",
    });

    await caller.waybills.updateStatus({ id: 1, status: "in_transit" });

    expect(dbMocks.updateWaybill).toHaveBeenCalledWith(1, { status: "in_transit" });
  });

  it("allows cancelling a draft while checking that it was not already closed", async () => {
    const caller = appRouter.createCaller(createContext());

    await caller.waybills.updateStatus({ id: 1, status: "cancelled" });

    expect(dbMocks.getWaybillById).toHaveBeenCalledWith(1);
    expect(dbMocks.updateWaybill).toHaveBeenCalledWith(1, { status: "cancelled" });
  });

  it("closes a complete waybill with the actual delivery weight", async () => {
    const caller = appRouter.createCaller(createContext());
    dbMocks.getWaybillById.mockResolvedValue({
      id: 1,
      number: "2026-001",
      contractId: 3,
      specificationId: 5,
      supplierName: "Поставщик",
      buyerName: "Покупатель",
      carrierName: "Перевозчик",
      loadingAddress: "Склад поставщика",
      unloadingAddress: "Элеватор",
      cargoName: "Пшеница",
      quantity: "20.500",
      driverName: "Иванов И.И.",
      tractorNumber: "А123ВС777",
      status: "in_transit",
    });

    await caller.waybills.close({
      id: 1,
      dispatchedWeight: "20.500",
      receivedWeight: "20.450",
      closedAt: new Date("2026-08-03T00:00:00.000Z"),
      closureNotes: "Принято без замечаний",
    });

    expect(dbMocks.closeWaybill).toHaveBeenCalledWith(1, {
      id: 1,
      dispatchedWeight: "20.500",
      receivedWeight: "20.450",
      closedAt: new Date("2026-08-03T00:00:00.000Z"),
      closureNotes: "Принято без замечаний",
    });
  });
});
