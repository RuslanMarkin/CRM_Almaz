import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { anonymousProcedure, publicProcedure, router } from "./_core/trpc";
import { createSessionToken, SESSION_MAX_AGE_MS, verifyAdminCredentials } from "./_core/passwordAuth";
import {
  getCounterparties,
  getCounterpartyById,
  createCounterparty,
  updateCounterparty,
  deleteCounterparty,
  getContracts,
  getContractById,
  createContract,
  updateContract,
  deleteContract,
  getDeals,
  getDealById,
  createDeal,
  updateDeal,
  deleteDeal,
  getSpecifications,
  getSpecificationById,
  createSpecification,
  updateSpecification,
  deleteSpecification,
  getDocumentAttachments,
  getDocumentAttachmentById,
  createDocumentAttachment,
  deleteDocumentAttachment,
  getOrganizationProfile,
  upsertOrganizationProfile,
  getWaybills,
  getWaybillById,
  getWaybillDetails,
  getLastCarrierData,
  createWaybill,
  updateWaybill,
  closeWaybill,
  deleteWaybill,
  getDashboardStats,
  getCounterpartyDocuments,
} from "./db";
import { deleteAttachmentObject, uploadAttachment, usesS3AttachmentStorage } from "./attachmentStorage";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const loginFailures = new Map<string, { count: number; startedAt: number; blockedUntil?: number }>();

function isLoginBlocked(ip: string): boolean {
  const attempt = loginFailures.get(ip);
  if (!attempt) return false;
  const now = Date.now();
  if (attempt.blockedUntil && attempt.blockedUntil > now) return true;
  if (now - attempt.startedAt > LOGIN_WINDOW_MS) loginFailures.delete(ip);
  return false;
}

function recordFailedLogin(ip: string) {
  const now = Date.now();
  const existing = loginFailures.get(ip);
  const attempt = !existing || now - existing.startedAt > LOGIN_WINDOW_MS
    ? { count: 1, startedAt: now }
    : { ...existing, count: existing.count + 1 };
  if (attempt.count >= MAX_FAILED_LOGIN_ATTEMPTS) attempt.blockedUntil = now + LOGIN_WINDOW_MS;
  loginFailures.set(ip, attempt);
}

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const counterpartyInput = z.object({
  name: z.string().min(1),
  shortName: z.string().optional(),
  type: z.enum(["legal", "individual", "sole_trader"]).default("legal"),
  businessRole: z.enum(["seller", "buyer", "carrier"]),
  region: z.string().optional(),
  profile: z.string().optional(),
  inn: z.string().optional(),
  ogrn: z.string().optional(),
  kpp: z.string().optional(),
  okpo: z.string().optional(),
  legalAddress: z.string().optional(),
  postalAddress: z.string().optional(),
  actualAddress: z.string().optional(),
  representativeName: z.string().optional(),
  representativePosition: z.string().optional(),
  authorityBasis: z.string().optional(),
  bankName: z.string().optional(),
  bankBik: z.string().optional(),
  bankAccount: z.string().optional(),
  corrAccount: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  notes: z.string().optional(),
});

const contractInput = z.object({
  number: z.string().min(1),
  counterpartyId: z.number().int().positive(),
  contractKind: z.enum(["purchase", "sale", "carriage"]),
  type: z.enum(["framework", "one_time", "service"]).default("framework"),
  subject: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  amount: z.string().optional(),
  currency: z.string().default("RUB"),
  status: z.enum(["draft", "active", "suspended", "completed", "terminated"]).default("draft"),
  notes: z.string().optional(),
});

const specificationInput = z.object({
  number: z.string().min(1),
  dealId: z.number().int().positive().nullable().optional(),
  contractId: z.number().int().positive(),
  counterpartyId: z.number().int().positive(),
  loadingAddress: z.string().optional(),
  unloadingAddress: z.string().optional(),
  cargoName: z.string().optional(),
  pricePerUnit: z.string().optional(),
  unit: z.string().default("т"),
  currency: z.string().default("RUB"),
  volumeTotal: z.string().optional(),
  volumeShipped: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.enum(["draft", "active", "completed", "cancelled"]).default("draft"),
  notes: z.string().optional(),
});

const dealInput = z.object({
  number: z.string().trim().min(1),
  sellerId: z.number().int().positive(),
  buyerId: z.number().int().positive(),
  carrierId: z.number().int().positive().nullable().optional(),
  cargoName: z.string().trim().min(1),
  cargoGrade: z.string().optional(),
  plannedVolume: z.string().optional(),
  purchasePrice: z.string().optional(),
  salePrice: z.string().optional(),
  currency: z.string().default("RUB"),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  status: z.enum(["planning", "active", "closing", "completed", "cancelled"]).default("planning"),
  notes: z.string().optional(),
});

const waybillInput = z.object({
  specificationId: z.number().int().positive().optional(),
  contractId: z.number().int().positive().optional(),
  supplierId: z.number().int().positive().optional(),
  supplierName: z.string().optional(),
  loadingAddress: z.string().optional(),
  buyerId: z.number().int().positive().optional(),
  buyerName: z.string().optional(),
  unloadingAddress: z.string().optional(),
  carrierId: z.number().int().positive().optional(),
  carrierName: z.string().optional(),
  vehicleOwnerId: z.number().int().positive().optional(),
  vehicleOwnerName: z.string().optional(),
  payerId: z.number().int().positive().optional(),
  payerName: z.string().optional(),
  driverName: z.string().optional(),
  vehicleMake: z.string().optional(),
  tractorNumber: z.string().optional(),
  trailerNumber: z.string().optional(),
  tripSheetNumber: z.string().optional(),
  routeNumber: z.string().optional(),
  garageNumber: z.string().optional(),
  grossWeight: z.string().optional(),
  tareWeight: z.string().optional(),
  netWeight: z.string().optional(),
  cargoName: z.string().optional(),
  cargoGrade: z.string().optional(),
  impurityPercent: z.string().optional(),
  moisturePercent: z.string().optional(),
  packageType: z.string().optional(),
  quantity: z.string().optional(),
  cargoClass: z.string().optional(),
  pricePerUnit: z.string().optional(),
  currency: z.string().default("RUB"),
  status: z.enum(["draft", "in_transit", "delivered", "cancelled"]).default("draft"),
  waybillDate: z.date().optional(),
  declarationInfo: z.string().optional(),
  notes: z.string().optional(),
});

const waybillCreateInput = waybillInput.extend({
  contractId: z.number().int().positive(),
  supplierName: z.string().trim().min(1),
  buyerName: z.string().trim().min(1),
  carrierName: z.string().trim().min(1),
  cargoName: z.string().trim().min(1),
});

const waybillClosureInput = z.object({
  id: z.number().int().positive(),
  dispatchedWeight: z.string().optional(),
  receivedWeight: z.string().optional(),
  closedAt: z.date().optional(),
  closureNotes: z.string().max(5000).optional(),
});

const attachmentEntityType = z.enum(["contract", "specification", "counterparty", "organization"]);
const attachmentDocumentKind = z.enum(["contract_scan", "specification_scan", "statutory_document", "other"]);
const attachmentInput = z.object({
  entityType: attachmentEntityType,
  entityId: z.number().int().positive(),
  documentKind: attachmentDocumentKind.default("other"),
  specificationId: z.number().int().positive().optional(),
  fileName: z.string().trim().min(1).max(512),
  contentType: z.string().trim().min(1).max(128),
  size: z.number().int().positive().max(15 * 1024 * 1024),
  dataUrl: z.string().min(1),
});

const organizationProfileInput = z.object({
  name: z.string().trim().min(1),
  shortName: z.string().optional(),
  inn: z.string().optional(),
  ogrn: z.string().optional(),
  kpp: z.string().optional(),
  legalAddress: z.string().optional(),
  postalAddress: z.string().optional(),
  representativeName: z.string().optional(),
  representativePosition: z.string().optional(),
  authorityBasis: z.string().optional(),
  bankName: z.string().optional(),
  bankBik: z.string().optional(),
  bankAccount: z.string().optional(),
  corrAccount: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

type WaybillRecord = NonNullable<Awaited<ReturnType<typeof getWaybillById>>>;

function hasText(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPositiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

const requiredRoleByContractKind = {
  purchase: "seller",
  sale: "buyer",
  carriage: "carrier",
} as const;

async function assertCounterpartyMatchesContractKind(
  counterpartyId: number,
  contractKind: keyof typeof requiredRoleByContractKind,
) {
  const counterparty = await getCounterpartyById(counterpartyId);
  if (!counterparty) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Контрагент не найден" });
  }
  const expectedRole = requiredRoleByContractKind[contractKind];
  if (counterparty.businessRole !== expectedRole) {
    const labels = { seller: "продавец", buyer: "покупатель", carrier: "перевозчик" };
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Для договора «${contractKind === "purchase" ? "Покупка" : contractKind === "sale" ? "Продажа" : "Перевозка"}» выберите контрагента с ролью «${labels[expectedRole]}»`,
    });
  }
}

async function assertDealParties(input: Pick<z.infer<typeof dealInput>, "sellerId" | "buyerId" | "carrierId">) {
  const parties = [
    { id: input.sellerId, role: "seller" as const, label: "продавец" },
    { id: input.buyerId, role: "buyer" as const, label: "покупатель" },
    ...(input.carrierId ? [{ id: input.carrierId, role: "carrier" as const, label: "перевозчик" }] : []),
  ];

  for (const party of parties) {
    const counterparty = await getCounterpartyById(party.id);
    if (!counterparty) throw new TRPCError({ code: "NOT_FOUND", message: "Контрагент не найден" });
    if (counterparty.businessRole !== party.role) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `Для сделки выберите контрагента с ролью «${party.label}»` });
    }
  }
}

function collectWaybillFormationErrors(waybill: WaybillRecord) {
  const errors: string[] = [];

  if (!waybill.contractId) errors.push("выберите договор");
  if (!waybill.specificationId) errors.push("выберите спецификацию");
  if (!hasText(waybill.supplierName)) errors.push("укажите поставщика / грузоотправителя");
  if (!hasText(waybill.buyerName)) errors.push("укажите грузополучателя");
  if (!hasText(waybill.carrierName)) errors.push("укажите перевозчика");
  if (!hasText(waybill.loadingAddress)) errors.push("укажите адрес погрузки");
  if (!hasText(waybill.unloadingAddress)) errors.push("укажите адрес разгрузки");
  if (!hasText(waybill.cargoName)) errors.push("укажите наименование груза");
  if (!hasPositiveNumber(waybill.quantity)) errors.push("укажите плановый вес");
  if (!hasText(waybill.driverName)) errors.push("укажите водителя");
  if (!hasText(waybill.tractorNumber)) errors.push("укажите номер тягача");

  return errors;
}

async function assertWaybillCanBeFormed(id: number) {
  const waybill = await getWaybillById(id);
  if (!waybill) {
    throw new TRPCError({ code: "NOT_FOUND", message: "ТТН не найдена" });
  }

  const errors = collectWaybillFormationErrors(waybill);
  if (errors.length > 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Нельзя сформировать ТТН:\n- ${errors.join("\n- ")}`,
    });
  }
}

// ─── Router ──────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: anonymousProcedure.query((opts) => opts.ctx.user),
    login: anonymousProcedure
      .input(z.object({ username: z.string().trim().min(1).max(128), password: z.string().min(1).max(1024) }))
      .mutation(async ({ ctx, input }) => {
        const ip = ctx.req.ip || "unknown";
        if (isLoginBlocked(ip)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Слишком много попыток входа. Повторите через 15 минут" });
        }
        if (!(await verifyAdminCredentials(input.username, input.password))) {
          recordFailedLogin(ip);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Неверный логин или пароль" });
        }
        loginFailures.delete(ip);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, await createSessionToken(input.username), {
          ...cookieOptions,
          maxAge: SESSION_MAX_AGE_MS,
        });
        return { success: true } as const;
      }),
    logout: anonymousProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  dashboard: router({
    stats: publicProcedure.query(() => getDashboardStats()),
  }),

  organization: router({
    get: publicProcedure.query(() => getOrganizationProfile()),
    upsert: publicProcedure
      .input(organizationProfileInput)
      .mutation(({ input }) => upsertOrganizationProfile(input)),
  }),

  // ─── Counterparties ───────────────────────────────────────────────────────
  counterparties: router({
    list: publicProcedure
      .input(z.object({ search: z.string().optional() }).optional())
      .query(({ input }) => getCounterparties(input?.search)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCounterpartyById(input.id)),

    getDocuments: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCounterpartyDocuments(input.id)),

    create: publicProcedure
      .input(counterpartyInput)
      .mutation(({ input }) => createCounterparty(input)),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: counterpartyInput.partial() }))
      .mutation(({ input }) => updateCounterparty(input.id, input.data)),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCounterparty(input.id)),
  }),

  // ─── Contracts ────────────────────────────────────────────────────────────
  contracts: router({
    list: publicProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            counterpartyId: z.number().optional(),
            status: z.string().optional(),
          })
          .optional()
      )
      .query(({ input }) => getContracts(input)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getContractById(input.id)),

    create: publicProcedure
      .input(contractInput)
      .mutation(async ({ input }) => {
        await assertCounterpartyMatchesContractKind(input.counterpartyId, input.contractKind);
        return createContract(input);
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: contractInput.partial() }))
      .mutation(async ({ input }) => {
        if (input.data.counterpartyId || input.data.contractKind) {
          const existing = await getContractById(input.id);
          if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Договор не найден" });
          const contractKind = input.data.contractKind ?? existing.contract.contractKind;
          if (contractKind) {
            await assertCounterpartyMatchesContractKind(
              input.data.counterpartyId ?? existing.contract.counterpartyId,
              contractKind,
            );
          }
        }
        return updateContract(input.id, input.data);
      }),

    updateStatus: publicProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["draft", "active", "suspended", "completed", "terminated"]),
        })
      )
      .mutation(({ input }) => updateContract(input.id, { status: input.status })),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteContract(input.id)),
  }),

  // ─── Deals ────────────────────────────────────────────────────────────────
  deals: router({
    list: publicProcedure
      .input(z.object({ status: z.string().optional() }).optional())
      .query(({ input }) => getDeals(input)),

    getById: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input }) => getDealById(input.id)),

    create: publicProcedure
      .input(dealInput)
      .mutation(async ({ input }) => {
        await assertDealParties(input);
        return createDeal(input);
      }),

    update: publicProcedure
      .input(z.object({ id: z.number().int().positive(), data: dealInput.partial() }))
      .mutation(async ({ input }) => {
        const existing = await getDealById(input.id);
        if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Сделка не найдена" });
        if (input.data.sellerId || input.data.buyerId || input.data.carrierId !== undefined) {
          await assertDealParties({
            sellerId: input.data.sellerId ?? existing.sellerId,
            buyerId: input.data.buyerId ?? existing.buyerId,
            carrierId: input.data.carrierId ?? existing.carrierId ?? undefined,
          });
        }
        return updateDeal(input.id, input.data);
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(({ input }) => deleteDeal(input.id)),
  }),

  // ─── Specifications ───────────────────────────────────────────────────────
  specifications: router({
    list: publicProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            dealId: z.number().optional(),
            contractId: z.number().optional(),
            counterpartyId: z.number().optional(),
            status: z.string().optional(),
          })
          .optional()
      )
      .query(({ input }) => getSpecifications(input)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getSpecificationById(input.id)),

    create: publicProcedure
      .input(specificationInput)
      .mutation(({ input }) => createSpecification(input)),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: specificationInput.partial() }))
      .mutation(({ input }) => updateSpecification(input.id, input.data)),

    updateStatus: publicProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["draft", "active", "completed", "cancelled"]),
        })
      )
      .mutation(({ input }) => updateSpecification(input.id, { status: input.status })),

    updateShipped: publicProcedure
      .input(z.object({ id: z.number(), volumeShipped: z.string() }))
      .mutation(({ input }) =>
        updateSpecification(input.id, { volumeShipped: input.volumeShipped })
      ),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteSpecification(input.id)),
  }),

  // ─── Document scan attachments ───────────────────────────────────────────
  attachments: router({
    list: publicProcedure
      .input(z.object({
        entityType: attachmentEntityType,
        entityId: z.number().int().positive(),
        documentKind: attachmentDocumentKind.optional(),
        specificationId: z.number().int().positive().optional(),
      }))
      .query(({ input }) => getDocumentAttachments(input.entityType, input.entityId, input)),

    create: publicProcedure
      .input(attachmentInput)
      .mutation(async ({ input }) => {
        if (!usesS3AttachmentStorage()) return createDocumentAttachment(input);

        const storageKey = await uploadAttachment(input);
        try {
          return await createDocumentAttachment({ ...input, dataUrl: null, storageKey });
        } catch (error) {
          await deleteAttachmentObject(storageKey).catch((cleanupError) => {
            console.error("Failed to clean up an unlinked attachment object:", cleanupError);
          });
          throw error;
        }
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ input }) => {
        const attachment = await getDocumentAttachmentById(input.id);
        const result = await deleteDocumentAttachment(input.id);
        if (attachment?.storageKey) {
          await deleteAttachmentObject(attachment.storageKey).catch((error) => {
            console.error(`Failed to delete attachment object ${attachment.id}:`, error);
          });
        }
        return result;
      }),
  }),

  // ─── Waybills ─────────────────────────────────────────────────────────────
  waybills: router({
    list: publicProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
            status: z.string().optional(),
            specificationId: z.number().optional(),
            counterpartyId: z.number().optional(),
          })
          .optional()
      )
      .query(({ input }) => getWaybills(input)),

    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getWaybillById(input.id)),

    getDetails: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getWaybillDetails(input.id)),

    lastCarrierData: publicProcedure
      .input(z.object({ carrierId: z.number().int().positive() }))
      .query(({ input }) => getLastCarrierData(input.carrierId)),

    create: publicProcedure
      .input(waybillCreateInput)
      .mutation(({ input }) => {
        if (input.status === "delivered") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Закройте ТТН через форму фактической доставки" });
        }
        return createWaybill(input);
      }),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: waybillInput.partial() }))
      .mutation(async ({ input }) => {
        if (input.data.status === "delivered") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Закройте ТТН через форму фактической доставки" });
        }
        const existing = await getWaybillById(input.id);
        if (existing?.status === "delivered" && (input.data.status !== undefined || input.data.specificationId !== undefined)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Закрытую ТТН нельзя перевести в другой статус или переназначить спецификацию" });
        }
        return updateWaybill(input.id, input.data);
      }),

    close: publicProcedure
      .input(waybillClosureInput)
      .mutation(async ({ input }) => {
        await assertWaybillCanBeFormed(input.id);
        try {
          return await closeWaybill(input.id, input);
        } catch (error) {
          throw new TRPCError({
            code: error instanceof Error && error.message === "Waybill not found" ? "NOT_FOUND" : "BAD_REQUEST",
            message: error instanceof Error ? error.message : "Не удалось закрыть ТТН",
          });
        }
      }),

    updateStatus: publicProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["draft", "in_transit", "delivered", "cancelled"]),
        })
      )
      .mutation(async ({ input }) => {
        const existing = await getWaybillById(input.id);
        if (existing?.status === "delivered" && input.status !== "delivered") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Закрытую ТТН нельзя перевести в другой статус" });
        }
        if (input.status === "delivered") {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Закройте ТТН через форму фактической доставки" });
        }
        if (input.status !== "draft" && input.status !== "cancelled") {
          await assertWaybillCanBeFormed(input.id);
        }
        return updateWaybill(input.id, { status: input.status });
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteWaybill(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
