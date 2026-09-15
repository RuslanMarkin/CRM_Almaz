import {
  int,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Counterparties (Контрагенты) ───────────────────────────────────────────

export const counterparties = mysqlTable("counterparties", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  shortName: varchar("shortName", { length: 256 }),
  type: mysqlEnum("type", ["legal", "individual", "sole_trader"]).default("legal").notNull(),
  businessRole: mysqlEnum("businessRole", ["seller", "buyer", "carrier"]),
  region: varchar("region", { length: 256 }),
  profile: text("profile"),
  inn: varchar("inn", { length: 12 }),
  ogrn: varchar("ogrn", { length: 15 }),
  kpp: varchar("kpp", { length: 9 }),
  okpo: varchar("okpo", { length: 10 }),
  legalAddress: text("legalAddress"),
  postalAddress: text("postalAddress"),
  actualAddress: text("actualAddress"),
  representativeName: varchar("representativeName", { length: 256 }),
  representativePosition: varchar("representativePosition", { length: 128 }),
  authorityBasis: varchar("authorityBasis", { length: 512 }),
  bankName: varchar("bankName", { length: 512 }),
  bankBik: varchar("bankBik", { length: 9 }),
  bankAccount: varchar("bankAccount", { length: 20 }),
  corrAccount: varchar("corrAccount", { length: 20 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Counterparty = typeof counterparties.$inferSelect;
export type InsertCounterparty = typeof counterparties.$inferInsert;

// ─── Contracts (Договоры) ────────────────────────────────────────────────────

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 128 }).notNull(),
  counterpartyId: int("counterpartyId").notNull(),
  contractKind: mysqlEnum("contractKind", ["purchase", "sale", "carriage"]),
  type: mysqlEnum("type", ["framework", "one_time", "service"]).default("framework").notNull(),
  subject: text("subject"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  amount: decimal("amount", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("RUB"),
  status: mysqlEnum("status", ["draft", "active", "suspended", "completed", "terminated"])
    .default("draft")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

// ─── Deals (Сделки) ─────────────────────────────────────────────────────────

export const deals = mysqlTable("deals", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 128 }).notNull().unique(),
  sellerId: int("sellerId").notNull(),
  buyerId: int("buyerId").notNull(),
  carrierId: int("carrierId"),
  cargoName: varchar("cargoName", { length: 512 }).notNull(),
  cargoGrade: varchar("cargoGrade", { length: 128 }),
  plannedVolume: decimal("plannedVolume", { precision: 10, scale: 3 }),
  purchasePrice: decimal("purchasePrice", { precision: 15, scale: 2 }),
  salePrice: decimal("salePrice", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("RUB"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  status: mysqlEnum("status", ["planning", "active", "closing", "completed", "cancelled"])
    .default("planning")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Deal = typeof deals.$inferSelect;
export type InsertDeal = typeof deals.$inferInsert;

// ─── Specifications (Спецификации) ───────────────────────────────────────────

export const specifications = mysqlTable("specifications", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 128 }).notNull(),
  dealId: int("dealId"),
  contractId: int("contractId").notNull(),
  counterpartyId: int("counterpartyId").notNull(),
  loadingAddress: text("loadingAddress"),
  unloadingAddress: text("unloadingAddress"),
  cargoName: varchar("cargoName", { length: 512 }),
  pricePerUnit: decimal("pricePerUnit", { precision: 15, scale: 2 }),
  unit: varchar("unit", { length: 32 }).default("т"),
  currency: varchar("currency", { length: 3 }).default("RUB"),
  volumeTotal: decimal("volumeTotal", { precision: 15, scale: 3 }),
  volumeShipped: decimal("volumeShipped", { precision: 15, scale: 3 }).default("0"),
  startDate: timestamp("startDate"),
  endDate: timestamp("endDate"),
  status: mysqlEnum("status", ["draft", "active", "completed", "cancelled"])
    .default("draft")
    .notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Specification = typeof specifications.$inferSelect;
export type InsertSpecification = typeof specifications.$inferInsert;

// ─── Document scan attachments ──────────────────────────────────────────────

export const documentAttachments = mysqlTable("document_attachments", {
  id: int("id").autoincrement().primaryKey(),
  entityType: mysqlEnum("entityType", ["contract", "specification", "counterparty", "organization"]).notNull(),
  entityId: int("entityId").notNull(),
  documentKind: mysqlEnum("documentKind", ["contract_scan", "specification_scan", "statutory_document", "other"])
    .default("other")
    .notNull(),
  specificationId: int("specificationId"),
  fileName: varchar("fileName", { length: 512 }).notNull(),
  contentType: varchar("contentType", { length: 128 }).notNull(),
  size: int("size").notNull(),
  // Legacy files remain in MySQL; new S3-backed files only keep their object key here.
  dataUrl: longtext("dataUrl"),
  storageKey: varchar("storageKey", { length: 1024 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type DocumentAttachment = typeof documentAttachments.$inferSelect;
export type InsertDocumentAttachment = typeof documentAttachments.$inferInsert;

// ─── Own organization (Наша организация) ───────────────────────────────────

export const organizationProfiles = mysqlTable("organization_profiles", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  shortName: varchar("shortName", { length: 256 }),
  inn: varchar("inn", { length: 12 }),
  ogrn: varchar("ogrn", { length: 15 }),
  kpp: varchar("kpp", { length: 9 }),
  legalAddress: text("legalAddress"),
  postalAddress: text("postalAddress"),
  representativeName: varchar("representativeName", { length: 256 }),
  representativePosition: varchar("representativePosition", { length: 128 }),
  authorityBasis: varchar("authorityBasis", { length: 512 }),
  bankName: varchar("bankName", { length: 512 }),
  bankBik: varchar("bankBik", { length: 9 }),
  bankAccount: varchar("bankAccount", { length: 20 }),
  corrAccount: varchar("corrAccount", { length: 20 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type OrganizationProfile = typeof organizationProfiles.$inferSelect;
export type InsertOrganizationProfile = typeof organizationProfiles.$inferInsert;

// ─── Waybills (Накладные) ────────────────────────────────────────────────────

export const waybills = mysqlTable("waybills", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 64 }).notNull().unique(),
  specificationId: int("specificationId"),
  contractId: int("contractId"),

  // Purchase block (Закупка)
  supplierId: int("supplierId"),
  supplierName: varchar("supplierName", { length: 512 }),
  loadingAddress: text("loadingAddress"),

  // Sale block (Продажа)
  buyerId: int("buyerId"),
  buyerName: varchar("buyerName", { length: 512 }),
  unloadingAddress: text("unloadingAddress"),

  // Carrier block (Перевозчик)
  carrierId: int("carrierId"),
  carrierName: varchar("carrierName", { length: 512 }),
  vehicleOwnerId: int("vehicleOwnerId"),
  vehicleOwnerName: varchar("vehicleOwnerName", { length: 512 }),
  payerId: int("payerId"),
  payerName: varchar("payerName", { length: 512 }),
  driverName: varchar("driverName", { length: 256 }),
  vehicleMake: varchar("vehicleMake", { length: 128 }),
  tractorNumber: varchar("tractorNumber", { length: 32 }),
  trailerNumber: varchar("trailerNumber", { length: 32 }),
  tripSheetNumber: varchar("tripSheetNumber", { length: 128 }),
  routeNumber: varchar("routeNumber", { length: 128 }),
  garageNumber: varchar("garageNumber", { length: 128 }),

  // Weight characteristics (Весовые характеристики)
  grossWeight: decimal("grossWeight", { precision: 10, scale: 3 }),
  tareWeight: decimal("tareWeight", { precision: 10, scale: 3 }),
  netWeight: decimal("netWeight", { precision: 10, scale: 3 }),

  // Delivery close-out (Факт по итогу доставки)
  dispatchedWeight: decimal("dispatchedWeight", { precision: 10, scale: 3 }),
  receivedWeight: decimal("receivedWeight", { precision: 10, scale: 3 }),
  closedAt: timestamp("closedAt"),
  closureNotes: text("closureNotes"),

  // Cargo
  cargoName: varchar("cargoName", { length: 512 }),
  cargoGrade: varchar("cargoGrade", { length: 128 }),
  impurityPercent: decimal("impurityPercent", { precision: 5, scale: 2 }),
  moisturePercent: decimal("moisturePercent", { precision: 5, scale: 2 }),
  packageType: varchar("packageType", { length: 64 }).default("н/у"),
  quantity: decimal("quantity", { precision: 10, scale: 3 }),
  cargoClass: varchar("cargoClass", { length: 64 }),
  pricePerUnit: decimal("pricePerUnit", { precision: 15, scale: 2 }),
  currency: varchar("currency", { length: 3 }).default("RUB"),

  status: mysqlEnum("status", ["draft", "in_transit", "delivered", "cancelled"])
    .default("draft")
    .notNull(),

  waybillDate: timestamp("waybillDate").defaultNow(),
  declarationInfo: text("declarationInfo"),
  notes: text("notes"),
  pdfKey: text("pdfKey"),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  deletedAt: timestamp("deletedAt"),
});

export type Waybill = typeof waybills.$inferSelect;
export type InsertWaybill = typeof waybills.$inferInsert;

// ─── Recovery audit log ────────────────────────────────────────────────────

export const recoveryAuditLog = mysqlTable("recovery_audit_log", {
  id: int("id").autoincrement().primaryKey(),
  entityType: varchar("entityType", { length: 64 }).notNull(),
  entityId: int("entityId").notNull(),
  action: mysqlEnum("action", ["delete", "restore"]).notNull(),
  actor: varchar("actor", { length: 256 }).notNull(),
  // Snapshot is deliberately kept after a delete to simplify an independent recovery review.
  snapshot: longtext("snapshot").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => [index("recovery_audit_entity_idx").on(table.entityType, table.entityId)]);

// ─── Waybill sequence counter ────────────────────────────────────────────────

export const waybillCounter = mysqlTable("waybill_counter", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  lastNumber: int("lastNumber").default(0).notNull(),
}, (table) => [
  uniqueIndex("waybill_counter_year_unique").on(table.year),
]);
