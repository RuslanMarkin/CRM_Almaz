import { and, desc, eq, like, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import path from "node:path";
import {
  InsertUser,
  users,
  counterparties,
  contracts,
  deals,
  specifications,
  documentAttachments,
  organizationProfiles,
  waybills,
  waybillCounter,
  type InsertCounterparty,
  type InsertContract,
  type InsertDeal,
  type InsertSpecification,
  type InsertDocumentAttachment,
  type InsertOrganizationProfile,
  type InsertWaybill,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { resolveWaybillClosure, type WaybillClosureInput } from "./waybillClosure";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function migrateDatabase() {
  const db = await getDb();
  if (!db) {
    throw new Error(
      "DATABASE_URL is required. Configure a persistent MySQL database before starting the app."
    );
  }

  const migrationsFolder = path.resolve(import.meta.dirname, "..", "drizzle");
  await migrate(db, { migrationsFolder });
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Counterparties ──────────────────────────────────────────────────────────

export async function getCounterparties(search?: string) {
  const db = await getDb();
  if (!db) return [];
  if (search) {
    return db
      .select()
      .from(counterparties)
      .where(
        or(
          like(counterparties.name, `%${search}%`),
          like(counterparties.inn, `%${search}%`),
          like(counterparties.shortName, `%${search}%`)
        )
      )
      .orderBy(desc(counterparties.createdAt));
  }
  return db.select().from(counterparties).orderBy(desc(counterparties.createdAt));
}

export async function getCounterpartyById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(counterparties).where(eq(counterparties.id, id)).limit(1);
  return result[0];
}

export async function createCounterparty(data: InsertCounterparty) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(counterparties).values(data);
  const insertId = Number(result[0].insertId);
  return getCounterpartyById(insertId);
}

export async function updateCounterparty(id: number, data: Partial<InsertCounterparty>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(counterparties).set(data).where(eq(counterparties.id, id));
}

export async function deleteCounterparty(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(counterparties).where(eq(counterparties.id, id));
}

// ─── Contracts ───────────────────────────────────────────────────────────────

export async function getContracts(opts?: { search?: string; counterpartyId?: number; status?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.search) {
    conditions.push(like(contracts.number, `%${opts.search}%`));
  }
  if (opts?.counterpartyId) {
    conditions.push(eq(contracts.counterpartyId, opts.counterpartyId));
  }
  if (opts?.status) {
    conditions.push(sql`${contracts.status} = ${opts.status}`);
  }
  const query = db
    .select({
      contract: contracts,
      counterparty: {
        id: counterparties.id,
        name: counterparties.name,
        shortName: counterparties.shortName,
        inn: counterparties.inn,
      },
    })
    .from(contracts)
    .leftJoin(counterparties, eq(contracts.counterpartyId, counterparties.id))
    .orderBy(desc(contracts.createdAt));
  if (conditions.length > 0) {
    return query.where(and(...conditions));
  }
  return query;
}

export async function getContractById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      contract: contracts,
      counterparty: counterparties,
    })
    .from(contracts)
    .leftJoin(counterparties, eq(contracts.counterpartyId, counterparties.id))
    .where(eq(contracts.id, id))
    .limit(1);
  return result[0];
}

export async function createContract(data: InsertContract) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(contracts).values(data);
}

export async function updateContract(id: number, data: Partial<InsertContract>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(contracts).set(data).where(eq(contracts.id, id));
}

export async function deleteContract(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(contracts).where(eq(contracts.id, id));
}

// ─── Deals ──────────────────────────────────────────────────────────────────

export async function getDeals(opts?: { status?: string }) {
  const db = await getDb();
  if (!db) return [];
  if (opts?.status) {
    return db.select().from(deals).where(sql`${deals.status} = ${opts.status}`).orderBy(desc(deals.createdAt));
  }
  return db.select().from(deals).orderBy(desc(deals.createdAt));
}

export async function getDealById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(deals).where(eq(deals.id, id)).limit(1);
  return result[0];
}

export async function createDeal(data: InsertDeal) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(deals).values(data);
  return getDealById(Number(result[0].insertId));
}

export async function updateDeal(id: number, data: Partial<InsertDeal>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(deals).set(data).where(eq(deals.id, id));
  return getDealById(id);
}

export async function deleteDeal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(specifications).set({ dealId: null }).where(eq(specifications.dealId, id));
  await db.delete(deals).where(eq(deals.id, id));
}

// ─── Specifications ──────────────────────────────────────────────────────────

export async function getSpecifications(opts?: {
  search?: string;
  dealId?: number;
  contractId?: number;
  counterpartyId?: number;
  status?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.search) conditions.push(like(specifications.number, `%${opts.search}%`));
  if (opts?.dealId) conditions.push(eq(specifications.dealId, opts.dealId));
  if (opts?.contractId) conditions.push(eq(specifications.contractId, opts.contractId));
  if (opts?.counterpartyId) conditions.push(eq(specifications.counterpartyId, opts.counterpartyId));
  if (opts?.status) conditions.push(sql`${specifications.status} = ${opts.status}`);

  const query = db
    .select({
      specification: specifications,
      counterparty: {
        id: counterparties.id,
        name: counterparties.name,
        shortName: counterparties.shortName,
      },
      contract: {
        id: contracts.id,
        number: contracts.number,
      },
    })
    .from(specifications)
    .leftJoin(counterparties, eq(specifications.counterpartyId, counterparties.id))
    .leftJoin(contracts, eq(specifications.contractId, contracts.id))
    .orderBy(desc(specifications.createdAt));

  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function getSpecificationById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select({
      specification: specifications,
      counterparty: counterparties,
      contract: contracts,
    })
    .from(specifications)
    .leftJoin(counterparties, eq(specifications.counterpartyId, counterparties.id))
    .leftJoin(contracts, eq(specifications.contractId, contracts.id))
    .where(eq(specifications.id, id))
    .limit(1);
  return result[0];
}

export async function createSpecification(data: InsertSpecification) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(specifications).values(data);
}

export async function updateSpecification(id: number, data: Partial<InsertSpecification>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(specifications).set(data).where(eq(specifications.id, id));
}

export async function deleteSpecification(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(specifications).where(eq(specifications.id, id));
}

// ─── Document scan attachments ──────────────────────────────────────────────

export type AttachmentEntityType = "contract" | "specification" | "counterparty" | "organization";
export type AttachmentDocumentKind = "contract_scan" | "specification_scan" | "statutory_document" | "other";

export async function getDocumentAttachments(
  entityType: AttachmentEntityType,
  entityId: number,
  filters?: { documentKind?: AttachmentDocumentKind; specificationId?: number },
) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [
    eq(documentAttachments.entityType, entityType),
    eq(documentAttachments.entityId, entityId),
  ];
  if (filters?.documentKind) conditions.push(eq(documentAttachments.documentKind, filters.documentKind));
  if (filters?.specificationId) conditions.push(eq(documentAttachments.specificationId, filters.specificationId));
  return db
    .select()
    .from(documentAttachments)
    .where(and(...conditions))
    .orderBy(desc(documentAttachments.createdAt));
}

export async function getDocumentAttachmentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(documentAttachments).where(eq(documentAttachments.id, id)).limit(1);
  return result[0];
}

// ─── Own organization ───────────────────────────────────────────────────────

export async function getOrganizationProfile() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizationProfiles).orderBy(organizationProfiles.id).limit(1);
  return result[0];
}

export async function upsertOrganizationProfile(data: Omit<InsertOrganizationProfile, "id" | "createdAt" | "updatedAt">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getOrganizationProfile();
  if (existing) {
    await db.update(organizationProfiles).set(data).where(eq(organizationProfiles.id, existing.id));
    return getOrganizationProfile();
  }
  await db.insert(organizationProfiles).values(data);
  return getOrganizationProfile();
}

export async function createDocumentAttachment(data: InsertDocumentAttachment) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.insert(documentAttachments).values(data);
  const result = await db
    .select()
    .from(documentAttachments)
    .where(and(eq(documentAttachments.entityType, data.entityType), eq(documentAttachments.entityId, data.entityId)))
    .orderBy(desc(documentAttachments.createdAt))
    .limit(1);
  return result[0];
}

export async function deleteDocumentAttachment(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(documentAttachments).where(eq(documentAttachments.id, id));
  return { success: true } as const;
}

// ─── Waybills ────────────────────────────────────────────────────────────────

export async function getNextWaybillNumber(): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const year = new Date().getFullYear();
  return db.transaction(async (tx) => {
    await tx
      .insert(waybillCounter)
      .values({ year, lastNumber: 1 })
      .onDuplicateKeyUpdate({
        set: { lastNumber: sql`${waybillCounter.lastNumber} + 1` },
      });

    const [counter] = await tx
      .select()
      .from(waybillCounter)
      .where(eq(waybillCounter.year, year))
      .limit(1);

    if (!counter) throw new Error("Failed to allocate waybill number");
    return `${year}-${String(counter.lastNumber).padStart(3, "0")}`;
  });
}

export async function getWaybills(opts?: {
  search?: string;
  status?: string;
  specificationId?: number;
  counterpartyId?: number;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.search) {
    conditions.push(
      or(
        like(waybills.number, `%${opts.search}%`),
        like(waybills.supplierName, `%${opts.search}%`),
        like(waybills.buyerName, `%${opts.search}%`),
        like(waybills.carrierName, `%${opts.search}%`)
      )
    );
  }
  if (opts?.status) conditions.push(sql`${waybills.status} = ${opts.status}`);
  if (opts?.specificationId) conditions.push(eq(waybills.specificationId, opts.specificationId));
  if (opts?.counterpartyId) {
    conditions.push(
      or(
        eq(waybills.supplierId, opts.counterpartyId),
        eq(waybills.buyerId, opts.counterpartyId),
        eq(waybills.carrierId, opts.counterpartyId),
        eq(waybills.vehicleOwnerId, opts.counterpartyId),
        eq(waybills.payerId, opts.counterpartyId)
      )
    );
  }

  const query = db.select().from(waybills).orderBy(desc(waybills.createdAt));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function getWaybillById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(waybills).where(eq(waybills.id, id)).limit(1);
  return result[0];
}

export async function getWaybillDetails(id: number) {
  const waybill = await getWaybillById(id);
  if (!waybill) return undefined;

  const [specificationData, contractData, supplier, buyer, carrier, vehicleOwner, payer] =
    await Promise.all([
      waybill.specificationId ? getSpecificationById(waybill.specificationId) : undefined,
      waybill.contractId ? getContractById(waybill.contractId) : undefined,
      waybill.supplierId ? getCounterpartyById(waybill.supplierId) : undefined,
      waybill.buyerId ? getCounterpartyById(waybill.buyerId) : undefined,
      waybill.carrierId ? getCounterpartyById(waybill.carrierId) : undefined,
      waybill.vehicleOwnerId ? getCounterpartyById(waybill.vehicleOwnerId) : undefined,
      waybill.payerId ? getCounterpartyById(waybill.payerId) : undefined,
    ]);

  return {
    waybill,
    specification: specificationData?.specification ?? null,
    contract: contractData?.contract ?? specificationData?.contract ?? null,
    supplier: supplier ?? null,
    buyer: buyer ?? null,
    carrier: carrier ?? null,
    vehicleOwner: vehicleOwner ?? null,
    payer: payer ?? null,
  };
}

export async function getLastCarrierData(carrierId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const [last] = await db
    .select({
      driverName: waybills.driverName,
      vehicleMake: waybills.vehicleMake,
      tractorNumber: waybills.tractorNumber,
      trailerNumber: waybills.trailerNumber,
      vehicleOwnerId: waybills.vehicleOwnerId,
      vehicleOwnerName: waybills.vehicleOwnerName,
    })
    .from(waybills)
    .where(eq(waybills.carrierId, carrierId))
    .orderBy(desc(waybills.createdAt))
    .limit(1);
  return last ?? null;
}

function preferredAddress(party: Awaited<ReturnType<typeof getCounterpartyById>>) {
  return party?.actualAddress ?? party?.legalAddress ?? undefined;
}

async function hydrateWaybillData(data: Partial<InsertWaybill>) {
  const hydrated: Partial<InsertWaybill> = { ...data };

  if (hydrated.specificationId) {
    const specData = await getSpecificationById(hydrated.specificationId);
    if (!specData) throw new Error("Specification not found");
    const spec = specData.specification;
    const supplier = specData.counterparty;

    if (hydrated.contractId && hydrated.contractId !== spec.contractId) {
      throw new Error("Specification does not belong to the selected contract");
    }
    hydrated.contractId ??= spec.contractId;
    hydrated.supplierId ??= supplier?.id ?? spec.counterpartyId;
    hydrated.supplierName ??= supplier?.shortName ?? supplier?.name ?? undefined;
    hydrated.loadingAddress ??= spec.loadingAddress ?? preferredAddress(supplier ?? undefined);
    hydrated.unloadingAddress ??= spec.unloadingAddress ?? undefined;
    hydrated.cargoName ??= spec.cargoName ?? undefined;
    hydrated.pricePerUnit ??= spec.pricePerUnit ?? undefined;
    hydrated.currency ??= spec.currency ?? "RUB";
  }

  if (hydrated.contractId && !(await getContractById(hydrated.contractId))) {
    throw new Error("Contract not found");
  }

  const [supplier, buyer, carrier, vehicleOwner, payer] = await Promise.all([
    hydrated.supplierId ? getCounterpartyById(hydrated.supplierId) : undefined,
    hydrated.buyerId ? getCounterpartyById(hydrated.buyerId) : undefined,
    hydrated.carrierId ? getCounterpartyById(hydrated.carrierId) : undefined,
    hydrated.vehicleOwnerId ? getCounterpartyById(hydrated.vehicleOwnerId) : undefined,
    hydrated.payerId ? getCounterpartyById(hydrated.payerId) : undefined,
  ]);

  hydrated.supplierName ??= supplier?.shortName ?? supplier?.name ?? undefined;
  hydrated.loadingAddress ??= preferredAddress(supplier);
  hydrated.buyerName ??= buyer?.shortName ?? buyer?.name ?? undefined;
  hydrated.unloadingAddress ??= preferredAddress(buyer);
  hydrated.carrierName ??= carrier?.shortName ?? carrier?.name ?? undefined;

  if (!hydrated.vehicleOwnerId && carrier) {
    hydrated.vehicleOwnerId = carrier.id;
    hydrated.vehicleOwnerName = carrier.shortName ?? carrier.name;
  } else {
    hydrated.vehicleOwnerName ??= vehicleOwner?.shortName ?? vehicleOwner?.name ?? undefined;
  }

  if (!hydrated.payerId && buyer) {
    hydrated.payerId = buyer.id;
    hydrated.payerName = buyer.shortName ?? buyer.name;
  } else {
    hydrated.payerName ??= payer?.shortName ?? payer?.name ?? undefined;
  }

  if (hydrated.grossWeight && hydrated.tareWeight && !hydrated.netWeight) {
    const gross = Number(hydrated.grossWeight);
    const tare = Number(hydrated.tareWeight);
    if (Number.isFinite(gross) && Number.isFinite(tare)) {
      if (gross < tare) throw new Error("Gross weight cannot be less than tare weight");
      hydrated.netWeight = (gross - tare).toFixed(3);
    }
  }

  return hydrated;
}

export async function createWaybill(data: Omit<InsertWaybill, "number">) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const hydrated = await hydrateWaybillData(data);
  const number = await getNextWaybillNumber();
  await db.insert(waybills).values({ ...hydrated, number });
  const created = await db
    .select()
    .from(waybills)
    .where(eq(waybills.number, number))
    .limit(1);
  return created[0];
}

export async function updateWaybill(id: number, data: Partial<InsertWaybill>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const hydrated = await hydrateWaybillData(data);
  await db.update(waybills).set(hydrated).where(eq(waybills.id, id));
}

export async function closeWaybill(
  id: number,
  data: WaybillClosureInput & { closedAt?: Date; closureNotes?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [waybill] = await db.select().from(waybills).where(eq(waybills.id, id)).limit(1);
  if (!waybill) throw new Error("Waybill not found");
  if (waybill.status === "cancelled") throw new Error("Нельзя закрыть отменённую ТТН");

  const closure = resolveWaybillClosure(data);
  const closedAt = data.closedAt ?? new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(waybills)
      .set({
        ...closure,
        closedAt,
        closureNotes: data.closureNotes?.trim() || null,
        status: "delivered",
      })
      .where(eq(waybills.id, id));

    if (waybill.specificationId) {
      const [total] = await tx
        .select({ total: sql<string>`coalesce(sum(${waybills.dispatchedWeight}), 0)` })
        .from(waybills)
        .where(and(eq(waybills.specificationId, waybill.specificationId), eq(waybills.status, "delivered")));

      await tx
        .update(specifications)
        .set({ volumeShipped: String(total?.total ?? "0") })
        .where(eq(specifications.id, waybill.specificationId));
    }
  });

  return getWaybillById(id);
}

export async function deleteWaybill(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const [waybill] = await db.select().from(waybills).where(eq(waybills.id, id)).limit(1);
  await db.transaction(async (tx) => {
    await tx.delete(waybills).where(eq(waybills.id, id));

    if (waybill?.status === "delivered" && waybill.specificationId) {
      const [total] = await tx
        .select({ total: sql<string>`coalesce(sum(${waybills.dispatchedWeight}), 0)` })
        .from(waybills)
        .where(and(eq(waybills.specificationId, waybill.specificationId), eq(waybills.status, "delivered")));
      await tx
        .update(specifications)
        .set({ volumeShipped: String(total?.total ?? "0") })
        .where(eq(specifications.id, waybill.specificationId));
    }
  });
}

// ─── Stats for dashboard ─────────────────────────────────────────────────────

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { counterparties: 0, contracts: 0, specifications: 0, waybills: 0 };
  const [cp, ct, sp, wb] = await Promise.all([
    db.select({ count: sql<number>`count(*)` }).from(counterparties),
    db.select({ count: sql<number>`count(*)` }).from(contracts),
    db.select({ count: sql<number>`count(*)` }).from(specifications),
    db.select({ count: sql<number>`count(*)` }).from(waybills),
  ]);
  return {
    counterparties: Number(cp[0]?.count ?? 0),
    contracts: Number(ct[0]?.count ?? 0),
    specifications: Number(sp[0]?.count ?? 0),
    waybills: Number(wb[0]?.count ?? 0),
  };
}

// ─── Documents linked to a counterparty ──────────────────────────────────────

export async function getCounterpartyDocuments(counterpartyId: number) {
  const db = await getDb();
  if (!db) return { contracts: [], specifications: [], waybills: [] };
  const [cList, sList] = await Promise.all([
    db.select().from(contracts).where(eq(contracts.counterpartyId, counterpartyId)).orderBy(desc(contracts.createdAt)),
    db.select().from(specifications).where(eq(specifications.counterpartyId, counterpartyId)).orderBy(desc(specifications.createdAt)),
  ]);
  const wList = await db
    .select()
    .from(waybills)
    .where(
      or(
        eq(waybills.supplierId, counterpartyId),
        eq(waybills.buyerId, counterpartyId),
        eq(waybills.carrierId, counterpartyId),
        eq(waybills.vehicleOwnerId, counterpartyId),
        eq(waybills.payerId, counterpartyId)
      )
    )
    .orderBy(desc(waybills.createdAt));
  return { contracts: cList, specifications: sList, waybills: wList };
}
