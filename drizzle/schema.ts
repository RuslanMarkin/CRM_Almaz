import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
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
  inn: varchar("inn", { length: 12 }),
  ogrn: varchar("ogrn", { length: 15 }),
  kpp: varchar("kpp", { length: 9 }),
  okpo: varchar("okpo", { length: 10 }),
  legalAddress: text("legalAddress"),
  actualAddress: text("actualAddress"),
  bankName: varchar("bankName", { length: 512 }),
  bankBik: varchar("bankBik", { length: 9 }),
  bankAccount: varchar("bankAccount", { length: 20 }),
  corrAccount: varchar("corrAccount", { length: 20 }),
  phone: varchar("phone", { length: 32 }),
  email: varchar("email", { length: 320 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Counterparty = typeof counterparties.$inferSelect;
export type InsertCounterparty = typeof counterparties.$inferInsert;

// ─── Contracts (Договоры) ────────────────────────────────────────────────────

export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 128 }).notNull(),
  counterpartyId: int("counterpartyId").notNull(),
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
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

// ─── Specifications (Спецификации) ───────────────────────────────────────────

export const specifications = mysqlTable("specifications", {
  id: int("id").autoincrement().primaryKey(),
  number: varchar("number", { length: 128 }).notNull(),
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
});

export type Specification = typeof specifications.$inferSelect;
export type InsertSpecification = typeof specifications.$inferInsert;

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
});

export type Waybill = typeof waybills.$inferSelect;
export type InsertWaybill = typeof waybills.$inferInsert;

// ─── Waybill sequence counter ────────────────────────────────────────────────

export const waybillCounter = mysqlTable("waybill_counter", {
  id: int("id").autoincrement().primaryKey(),
  year: int("year").notNull(),
  lastNumber: int("lastNumber").default(0).notNull(),
}, (table) => [
  uniqueIndex("waybill_counter_year_unique").on(table.year),
]);
