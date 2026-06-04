import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
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
  getSpecifications,
  getSpecificationById,
  createSpecification,
  updateSpecification,
  deleteSpecification,
  getWaybills,
  getWaybillById,
  getWaybillDetails,
  getLastCarrierData,
  createWaybill,
  updateWaybill,
  deleteWaybill,
  getDashboardStats,
  getCounterpartyDocuments,
} from "./db";

// ─── Zod schemas ─────────────────────────────────────────────────────────────

const counterpartyInput = z.object({
  name: z.string().min(1),
  shortName: z.string().optional(),
  type: z.enum(["legal", "individual", "sole_trader"]).default("legal"),
  inn: z.string().optional(),
  ogrn: z.string().optional(),
  kpp: z.string().optional(),
  okpo: z.string().optional(),
  legalAddress: z.string().optional(),
  actualAddress: z.string().optional(),
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

// ─── Router ──────────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  dashboard: router({
    stats: publicProcedure.query(() => getDashboardStats()),
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
      .mutation(({ input }) => createContract(input)),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: contractInput.partial() }))
      .mutation(({ input }) => updateContract(input.id, input.data)),

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

  // ─── Specifications ───────────────────────────────────────────────────────
  specifications: router({
    list: publicProcedure
      .input(
        z
          .object({
            search: z.string().optional(),
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
      .mutation(({ input }) => createWaybill(input)),

    update: publicProcedure
      .input(z.object({ id: z.number(), data: waybillInput.partial() }))
      .mutation(({ input }) => updateWaybill(input.id, input.data)),

    updateStatus: publicProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["draft", "in_transit", "delivered", "cancelled"]),
        })
      )
      .mutation(({ input }) => updateWaybill(input.id, { status: input.status })),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteWaybill(input.id)),
  }),
});

export type AppRouter = typeof appRouter;
