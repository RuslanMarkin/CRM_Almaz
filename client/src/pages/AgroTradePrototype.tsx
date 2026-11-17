import { useEffect, useMemo, useState } from "react";
import { ScanAttachments } from "@/components/ScanAttachments";
import { trpc } from "@/lib/trpc";
import { COUNTERPARTY_STATUSES, COUNTERPARTY_STATUS_VALUES, type CounterpartyStatus } from "@shared/counterpartyStatus";
import { COUNTERPARTY_VAT_TYPES, type CounterpartyVatType } from "@shared/counterpartyVat";
import { toast } from "sonner";
import { Calculator, LogOut, Plus, Truck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { DealDeskModal, type DealDeskSubmission } from "@/components/DealDeskModal";
import { AddContractSpecificationModal, type ContractRef, type SpecEditingData } from "@/components/AddContractSpecificationModal";
import Waybills from "./Waybills";
import Contracts from "./Contracts";
import Specifications from "./Specifications";

type ViewKey =
  | "dashboard"
  | "deals"
  | "contractors"
  | "contracts"
  | "specifications"
  | "logistics"
  | "receivables"
  | "bank"
  | "ai-agent"
  | "ttn";

interface AgroTradePrototypeProps {
  initialView?: ViewKey;
  initialCounterpartyId?: number;
}

type CounterpartyRole = "seller" | "buyer" | "carrier";
type CounterpartyTab = "all" | CounterpartyRole;
type CounterpartyFormState = {
  name: string;
  shortName: string;
  type: "legal" | "individual" | "sole_trader";
  businessRole: CounterpartyRole;
  vatType: CounterpartyVatType;
  status: CounterpartyStatus;
  region: string;
  profile: string;
  inn: string;
  ogrn: string;
  kpp: string;
  okpo: string;
  legalAddress: string;
  postalAddress: string;
  actualAddress: string;
  loadingAddress: string;
  representativeName: string;
  representativePosition: string;
  authorityBasis: string;
  bankName: string;
  bankBik: string;
  bankAccount: string;
  corrAccount: string;
  phone: string;
  email: string;
  notes: string;
};

type OrganizationFormState = {
  name: string;
  shortName: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legalAddress: string;
  postalAddress: string;
  representativeName: string;
  representativePosition: string;
  authorityBasis: string;
  bankName: string;
  bankBik: string;
  bankAccount: string;
  corrAccount: string;
  phone: string;
  email: string;
};

type DealStatus = "planning" | "active" | "closing" | "completed" | "cancelled";
type DealFormState = {
  number: string;
  sellerId: string;
  buyerId: string;
  carrierId: string;
  cargoName: string;
  cargoGrade: string;
  plannedVolume: string;
  purchasePrice: string;
  salePrice: string;
  currency: string;
  startDate: string;
  endDate: string;
  status: DealStatus;
  notes: string;
  specificationIds: number[];
};

const roleLabels: Record<CounterpartyRole, string> = {
  seller: "Продавец",
  buyer: "Покупатель",
  carrier: "Перевозчик",
};

const emptyCounterpartyForm: CounterpartyFormState = {
  name: "",
  shortName: "",
  type: "legal",
  businessRole: "seller",
  vatType: "with_vat",
  status: "normal",
  region: "",
  profile: "",
  inn: "",
  ogrn: "",
  kpp: "",
  okpo: "",
  legalAddress: "",
  postalAddress: "",
  actualAddress: "",
  loadingAddress: "",
  representativeName: "",
  representativePosition: "",
  authorityBasis: "Устав",
  bankName: "",
  bankBik: "",
  bankAccount: "",
  corrAccount: "",
  phone: "",
  email: "",
  notes: "",
};

const emptyOrganizationForm: OrganizationFormState = {
  name: "Алмаз Агро",
  shortName: "Алмаз Агро",
  inn: "",
  kpp: "",
  ogrn: "",
  legalAddress: "",
  postalAddress: "",
  representativeName: "",
  representativePosition: "",
  authorityBasis: "Устав",
  bankName: "",
  bankBik: "",
  bankAccount: "",
  corrAccount: "",
  phone: "",
  email: "",
};

const emptyDealForm: DealFormState = {
  number: "",
  sellerId: "",
  buyerId: "",
  carrierId: "",
  cargoName: "",
  cargoGrade: "",
  plannedVolume: "",
  purchasePrice: "",
  salePrice: "",
  currency: "RUB",
  startDate: "",
  endDate: "",
  status: "planning",
  notes: "",
  specificationIds: [],
};

function toCounterpartyForm(counterparty: Partial<Record<keyof CounterpartyFormState, string | null>>): CounterpartyFormState {
  const form = {
    ...emptyCounterpartyForm,
    ...Object.fromEntries(Object.entries(counterparty).map(([key, value]) => [key, value ?? ""])),
  } as CounterpartyFormState;
  if (!COUNTERPARTY_STATUS_VALUES.includes(form.status)) form.status = "normal";
  if (form.vatType !== "without_vat") form.vatType = "with_vat";
  return form;
}

function toOrganizationForm(profile: Partial<Record<keyof OrganizationFormState, string | null>>): OrganizationFormState {
  return {
    ...emptyOrganizationForm,
    ...Object.fromEntries(Object.entries(profile).map(([key, value]) => [key, value ?? ""])),
  } as OrganizationFormState;
}

const navItems: Array<{ key: ViewKey; icon: string; label: string; disabled?: boolean }> = [
  { key: "dashboard", icon: "◧", label: "Дашборд" },
  { key: "deals", icon: "⇄", label: "Сделки" },
  { key: "contractors", icon: "☰", label: "Контрагенты" },
  { key: "contracts", icon: "§", label: "Договоры" },
  { key: "specifications", icon: "☷", label: "Спецификации" },
  { key: "ttn", icon: "▥", label: "ТТН" },
];

export default function AgroTradePrototype({ initialView = "dashboard", initialCounterpartyId }: AgroTradePrototypeProps) {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState<ViewKey>(initialView);
  const [counterpartyTab, setCounterpartyTab] = useState<CounterpartyTab>("all");
  const [counterpartyVatTab, setCounterpartyVatTab] = useState<"all" | CounterpartyVatType>("all");
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<number | null>(initialCounterpartyId ?? null);
  const [counterpartyFormOpen, setCounterpartyFormOpen] = useState(false);
  const [organizationFormOpen, setOrganizationFormOpen] = useState(false);
  const [editingCounterpartyId, setEditingCounterpartyId] = useState<number | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [dealFormOpen, setDealFormOpen] = useState(false);
  const [dealDeskOpen, setDealDeskOpen] = useState(false);
  const [dealDeskInitial, setDealDeskInitial] = useState<any>(undefined);
  const [dealDeskSaving, setDealDeskSaving] = useState(false);
  const [editingDealId, setEditingDealId] = useState<number | null>(null);
  const [counterpartyForm, setCounterpartyForm] = useState<CounterpartyFormState>(emptyCounterpartyForm);
  const [organizationForm, setOrganizationForm] = useState<OrganizationFormState>(emptyOrganizationForm);
  const [dealForm, setDealForm] = useState<DealFormState>(emptyDealForm);
  const utils = trpc.useUtils();
  const { data: contracts = [] } = trpc.contracts.list.useQuery({});
  const { data: dealRecords = [], isLoading: dealsLoading } = trpc.deals.list.useQuery({});
  const { data: specifications = [] } = trpc.specifications.list.useQuery({});
  const { data: waybills = [] } = trpc.waybills.list.useQuery({});
  const { data: counterparties = [], isLoading: counterpartiesLoading } = trpc.counterparties.list.useQuery();
  const { data: organizationProfile } = trpc.organization.get.useQuery();

  const createContractMutation = trpc.contracts.create.useMutation();
  const createSpecificationMutation = trpc.specifications.create.useMutation();

  const [specModalOpen, setSpecModalOpen] = useState(false);
  const [specModalContract, setSpecModalContract] = useState<ContractRef | null>(null);
  const [specModalNextNumber, setSpecModalNextNumber] = useState<string>("1");
  const [specModalEditing, setSpecModalEditing] = useState<SpecEditingData | null>(null);
  const [specFilterTabs, setSpecFilterTabs] = useState<Record<number, "all" | "active" | "past">>({});

  const updateSpecStatusMutation = trpc.specifications.updateStatus.useMutation({
    onSuccess: () => {
      utils.specifications.list.invalidate();
      toast.success("Статус спецификации обновлен");
    },
    onError: (err) => {
      toast.error(err.message || "Ошибка обновления статуса");
    },
  });

  function openAddSpecModal(contract: ContractRef, existingCount: number) {
    setSpecModalContract(contract);
    setSpecModalNextNumber(String(existingCount + 1));
    setSpecModalEditing(null);
    setSpecModalOpen(true);
  }

  function openEditSpecModal(contract: ContractRef, spec: SpecEditingData) {
    setSpecModalContract(contract);
    setSpecModalEditing(spec);
    setSpecModalOpen(true);
  }

  useEffect(() => {
    if (initialCounterpartyId) {
      setSelectedCounterpartyId(initialCounterpartyId);
      setActiveView("contractors");
    }
  }, [initialCounterpartyId]);

  const createCounterparty = trpc.counterparties.create.useMutation({
    onSuccess: (counterparty) => {
      utils.counterparties.list.invalidate();
      utils.dashboard.stats.invalidate();
      setCounterpartyFormOpen(false);
      setCounterpartyForm(emptyCounterpartyForm);
      if (counterparty?.id) {
        setSelectedCounterpartyId(counterparty.id);
        window.history.pushState(null, "", `/counterparties/${counterparty.id}`);
      }
      toast.success("Контрагент добавлен");
    },
    onError: (error) => toast.error(error.message),
  });
  const updateCounterparty = trpc.counterparties.update.useMutation({
    onSuccess: () => {
      utils.counterparties.list.invalidate();
      setCounterpartyFormOpen(false);
      setEditingCounterpartyId(null);
      toast.success("Карточка контрагента обновлена");
    },
    onError: (error) => toast.error(error.message),
  });
  const saveOrganizationProfile = trpc.organization.upsert.useMutation({
    onSuccess: () => {
      utils.organization.get.invalidate();
      setOrganizationFormOpen(false);
      toast.success("Карточка собственной организации сохранена");
    },
    onError: (error) => toast.error(error.message),
  });
  const createDeal = trpc.deals.create.useMutation();
  const updateDeal = trpc.deals.update.useMutation();
  const updateSpecificationDeal = trpc.specifications.update.useMutation();

  function showView(view: ViewKey) {
    setActiveView(view);
    const path = view === "dashboard" ? "/dashboard" : view === "contractors" ? "/counterparties" : `/${view}`;
    if (window.location.pathname !== path) {
      window.history.pushState(null, "", path);
    }
  }

  function closeCounterpartyDialog() {
    setSelectedCounterpartyId(null);
    if (window.location.pathname.startsWith("/counterparties/") || window.location.pathname.startsWith("/contractors/")) {
      window.history.pushState(null, "", "/counterparties");
    }
  }

  useEffect(() => {
    const handlePopState = () => {
      const pathname = window.location.pathname;
      const matchDetail = pathname.match(/^\/(?:counterparties|contractors)\/(\d+)$/);
      if (matchDetail) {
        setActiveView("contractors");
        setSelectedCounterpartyId(parseInt(matchDetail[1], 10));
        return;
      }
      const raw = pathname.replace(/^\//, "");
      const p = (raw === "counterparties" ? "contractors" : raw) as ViewKey;
      if (p && navItems.some((item) => item.key === p)) {
        setActiveView(p);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const filteredCounterparties = counterparties.filter((counterparty) => {
    if (counterpartyTab !== "all" && counterparty.businessRole !== counterpartyTab) return false;
    if (counterpartyVatTab !== "all" && (counterparty.vatType ?? "with_vat") !== counterpartyVatTab) return false;
    return true;
  });
  const selectedCounterparty = counterparties.find((counterparty) => counterparty.id === selectedCounterpartyId) ?? null;
  const selectedCounterpartyContracts = selectedCounterparty
    ? contracts.filter((item) => item.contract.counterpartyId === selectedCounterparty.id)
    : [];
  const selectedCounterpartyWaybills = useMemo(() => {
    if (!selectedCounterparty) return [];
    return waybills.filter(
      (w) =>
        w.supplierId === selectedCounterparty.id ||
        w.buyerId === selectedCounterparty.id ||
        w.carrierId === selectedCounterparty.id
    );
  }, [selectedCounterparty, waybills]);
  const dealViewModels = useMemo(() => dealRecords.map((deal) => {
    const linkedSpecifications = specifications.filter((item) => item.specification.dealId === deal.id);
    const linkedContractIds = new Set(linkedSpecifications.map((item) => item.specification.contractId));
    const linkedContracts = contracts.filter((item) => linkedContractIds.has(item.contract.id));
    const linkedWaybills = waybills.filter((waybill) => linkedSpecifications.some(
      (specification) => specification.specification.id === waybill.specificationId,
    ));

    // Fallbacks from deal participants if contracts exist
    const sellerContract = contracts.find((item) => item.contract.counterpartyId === deal.sellerId && item.contract.contractKind === "purchase");
    const buyerContract = contracts.find((item) => item.contract.counterpartyId === deal.buyerId && item.contract.contractKind === "sale");
    const carrierContract = deal.carrierId ? contracts.find((item) => item.contract.counterpartyId === deal.carrierId && item.contract.contractKind === "carriage") : undefined;

    const purchaseContract = linkedContracts.find((item) => item.contract.contractKind === "purchase") ?? sellerContract;
    const saleContract = linkedContracts.find((item) => item.contract.contractKind === "sale") ?? buyerContract;
    const carriageContract = linkedContracts.find((item) => item.contract.contractKind === "carriage") ?? carrierContract;

    const hasPurchaseSpec = linkedSpecifications.some((s) => {
      const c = contracts.find((row) => row.contract.id === s.specification.contractId);
      return c?.contract.contractKind === "purchase";
    });
    const hasSaleSpec = linkedSpecifications.some((s) => {
      const c = contracts.find((row) => row.contract.id === s.specification.contractId);
      return c?.contract.contractKind === "sale";
    });

    const weightProblem = linkedWaybills.some((waybill) => (
      waybill.status === "delivered" && (
        waybill.dispatchedWeight === null || waybill.receivedWeight === null ||
        Math.abs(decimal(waybill.dispatchedWeight) - decimal(waybill.receivedWeight)) > 0.001
      )
    ));
    const allWaybillsClosed = linkedWaybills.length > 0 && linkedWaybills.every((waybill) => (
      waybill.status === "delivered" && waybill.dispatchedWeight !== null && waybill.receivedWeight !== null
    ));

    const stages = [
      {
        title: "Условия сделки",
        detail: `${deal.cargoName} · ${formatTons(decimal(deal.plannedVolume))}`,
        state: "complete" as const,
      },
      {
        title: "Договор закупки",
        detail: purchaseContract ? `Договор № ${purchaseContract.contract.number}` : "Нужен договор с продавцом",
        state: purchaseContract ? ("complete" as const) : ("waiting" as const),
      },
      {
        title: "Договор реализации",
        detail: saleContract ? `Договор № ${saleContract.contract.number}` : "Нужен договор с покупателем",
        state: saleContract ? ("complete" as const) : ("waiting" as const),
      },
      {
        title: "Спецификации",
        detail: hasPurchaseSpec && hasSaleSpec
          ? `${linkedSpecifications.length} привязано (закупка + продажа)`
          : linkedSpecifications.length
            ? `${linkedSpecifications.length} привязано (требуются закупка и реализация)`
            : "Нужны спецификации закупки и реализации",
        state: hasPurchaseSpec && hasSaleSpec ? ("complete" as const) : ("waiting" as const),
      },
      {
        title: "Перевозчики",
        detail: (() => {
          const uniqueCarrierNames = Array.from(new Set(linkedWaybills.map((w) => w.carrierName).filter(Boolean)));
          if (uniqueCarrierNames.length > 0) {
            return uniqueCarrierNames.length === 1
              ? String(uniqueCarrierNames[0])
              : `${uniqueCarrierNames.length} перевозчиков в рейсах (${uniqueCarrierNames.slice(0, 2).join(", ")}${uniqueCarrierNames.length > 2 ? "..." : ""})`;
          }
          if (deal.carrierId) {
            return carriageContract ? `Назначен · Договор № ${carriageContract.contract.number}` : "Генеральный перевозчик назначен";
          }
          return "Пул перевозчиков (помашинно в ТТН)";
        })(),
        state: (deal.carrierId || linkedWaybills.some((w) => w.carrierName || w.carrierId)) ? ("complete" as const) : ("waiting" as const),
      },
      {
        title: "Отгрузка",
        detail: linkedWaybills.length
          ? `ТТН: ${linkedWaybills.length}${linkedWaybills.filter((w) => w.status === "in_transit").length ? `, в пути: ${linkedWaybills.filter((w) => w.status === "in_transit").length}` : ""}`
          : "ТТН ещё не сформированы",
        state: linkedWaybills.length ? ("complete" as const) : ("waiting" as const),
      },
      {
        title: "Закрытие и вес",
        detail: !linkedWaybills.length
          ? "Ожидается закрытие ТТН"
          : weightProblem
            ? "Есть расхождения по весу"
            : allWaybillsClosed
              ? "Все ТТН закрыты без расхождений"
              : "ТТН ещё в пути / ожидают приёмки",
        state: !linkedWaybills.length
          ? ("waiting" as const)
          : weightProblem
            ? ("attention" as const)
            : allWaybillsClosed
              ? ("complete" as const)
              : ("waiting" as const),
      },
    ];
    return { deal, linkedSpecifications, linkedContracts, linkedWaybills, stages, weightProblem, allWaybillsClosed };
  }), [contracts, dealRecords, specifications, waybills]);
  const selectedDeal = dealViewModels.find((item) => item.deal.id === selectedDealId) ?? null;

  const dashboardData = useMemo(() => {
    const activeContracts = contracts.filter((item) => item.contract.status === "active").length;
    const openSpecifications = specifications.filter((item) => ["draft", "active"].includes(item.specification.status));
    const remainingVolume = openSpecifications.reduce(
      (total, item) => total + Math.max(0, decimal(item.specification.volumeTotal) - decimal(item.specification.volumeShipped)),
      0,
    );
    const inTransit = waybills.filter((waybill) => waybill.status === "in_transit");
    const plannedInTransit = inTransit.reduce((total, waybill) => total + decimal(waybill.quantity), 0);
    const delivered = waybills.filter((waybill) => waybill.status === "delivered");
    const weightIssues = delivered.filter((waybill) => {
      if (waybill.dispatchedWeight === null || waybill.receivedWeight === null) return true;
      return Math.abs(decimal(waybill.dispatchedWeight) - decimal(waybill.receivedWeight)) > 0.001;
    });
    const documentedWeightDifferences = delivered.filter(
      (waybill) => waybill.dispatchedWeight !== null && waybill.receivedWeight !== null,
    ).reduce((total, waybill) => total + Math.abs(decimal(waybill.dispatchedWeight) - decimal(waybill.receivedWeight)), 0);
    const roleMissing = counterparties.filter((counterparty) => !counterparty.businessRole).length;
    const incompleteCounterparties = counterparties.filter(
      (counterparty) => !counterparty.inn || !counterparty.bankAccount || !counterparty.representativeName,
    ).length;
    const contractsWithoutKind = contracts.filter((item) => !item.contract.contractKind).length;
    const latestDocuments = [
      ...contracts.map((item) => ({ type: "Договор", label: `№ ${item.contract.number}`, detail: item.counterparty?.shortName ?? item.counterparty?.name ?? "Контрагент", createdAt: item.contract.createdAt })),
      ...specifications.map((item) => ({ type: "Спецификация", label: `№ ${item.specification.number}`, detail: item.specification.cargoName ?? "Груз не указан", createdAt: item.specification.createdAt })),
      ...waybills.map((item) => ({ type: "ТТН", label: `№ ${item.number}`, detail: `${item.supplierName ?? "—"} → ${item.buyerName ?? "—"}`, createdAt: item.createdAt })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 6);

    return {
      activeContracts,
      openSpecifications: openSpecifications.length,
      remainingVolume,
      inTransit: inTransit.length,
      plannedInTransit,
      weightIssues: weightIssues.length,
      documentedWeightDifferences,
      roleMissing,
      incompleteCounterparties,
      contractsWithoutKind,
      latestDocuments,
    };
  }, [contracts, counterparties, specifications, waybills]);

  function openCreateCounterparty() {
    setEditingCounterpartyId(null);
    setCounterpartyForm(emptyCounterpartyForm);
    setCounterpartyFormOpen(true);
  }

  function openOrganizationProfile() {
    setOrganizationForm(toOrganizationForm(organizationProfile ?? {}));
    setOrganizationFormOpen(true);
  }

  function openEditCounterparty() {
    if (!selectedCounterparty) return;
    setEditingCounterpartyId(selectedCounterparty.id);
    setCounterpartyForm(toCounterpartyForm(selectedCounterparty));
    setCounterpartyFormOpen(true);
  }

  function openCreateDeal() {
    setEditingDealId(null);
    setDealDeskInitial(undefined);
    setDealDeskOpen(true);
  }

  function openEditDeal(dealId: number) {
    const model = dealViewModels.find((item) => item.deal.id === dealId);
    if (!model) return;
    const deal = model.deal;
    setEditingDealId(deal.id);
    const tariffMatch = deal.notes?.match(/Тариф перевозки:\s*(\d+(?:\.\d+)?)/i);
    const carrierTariff = tariffMatch ? tariffMatch[1] : "1500";
    setDealDeskInitial({
      number: deal.number,
      sellerId: String(deal.sellerId),
      buyerId: String(deal.buyerId),
      carrierId: deal.carrierId ? String(deal.carrierId) : "",
      cargoName: deal.cargoName,
      cargoGrade: deal.cargoGrade ?? "",
      plannedVolume: deal.plannedVolume ?? "",
      purchasePrice: deal.purchasePrice ?? "",
      salePrice: deal.salePrice ?? "",
      carrierTariff,
      currency: deal.currency ?? "RUB",
      startDate: deal.startDate ? new Date(deal.startDate).toISOString().split("T")[0] : "",
      endDate: deal.endDate ? new Date(deal.endDate).toISOString().split("T")[0] : "",
      status: deal.status,
      notes: deal.notes ?? "",
      specificationIds: model.linkedSpecifications.map((item) => item.specification.id),
    });
    setSelectedDealId(null);
    setDealDeskOpen(true);
  }

  async function handleDealDeskSubmit(params: DealDeskSubmission) {
    setDealDeskSaving(true);
    try {
      const dealData = {
        number: params.deal.number,
        sellerId: params.deal.sellerId,
        buyerId: params.deal.buyerId,
        carrierId: params.deal.carrierId,
        cargoName: params.deal.cargoName,
        cargoGrade: params.deal.cargoGrade,
        plannedVolume: params.deal.plannedVolume,
        purchasePrice: params.deal.purchasePrice,
        salePrice: params.deal.salePrice,
        currency: params.deal.currency,
        startDate: params.deal.startDate ? new Date(params.deal.startDate) : undefined,
        endDate: params.deal.endDate ? new Date(params.deal.endDate) : undefined,
        status: params.deal.status,
        notes: params.carrierTariff
          ? `Тариф перевозки: ${params.carrierTariff} ₽/т. ${params.deal.notes || ""}`.trim()
          : params.deal.notes,
      };

      const saved = editingDealId
        ? await updateDeal.mutateAsync({ id: editingDealId, data: dealData })
        : await createDeal.mutateAsync(dealData);
      if (!saved) throw new Error("Не удалось сохранить сделку");

      const dealId = saved.id;
      const specIdsToLink = [...(params.specificationIds || [])];

      // Auto-generate contracts and specifications if requested for new deal
      if (params.autoGenerateDocuments && !editingDealId) {
        const vol = Number(params.deal.plannedVolume) || 0;
        const pPrice = Number(params.deal.purchasePrice) || 0;
        const sPrice = Number(params.deal.salePrice) || 0;
        const tPrice = Number(params.carrierTariff) || 0;

        try {
          // A. Purchase Contract & Specification
          const pContract = await createContractMutation.mutateAsync({
            number: `ДЗ-${params.deal.number}`,
            counterpartyId: params.deal.sellerId,
            contractKind: "purchase",
            type: "framework",
            subject: `Поставка зерна: ${params.deal.cargoName}`,
            amount: vol && pPrice ? String(vol * pPrice) : undefined,
            status: "active",
          });

          if (pContract?.contract?.id) {
            const pSpec = await createSpecificationMutation.mutateAsync({
              number: `СПЗ-${params.deal.number}`,
              contractId: pContract.contract.id,
              counterpartyId: params.deal.sellerId,
              cargoName: params.deal.cargoName,
              volumeTotal: params.deal.plannedVolume,
              pricePerUnit: params.deal.purchasePrice,
              loadingAddress: params.loadingAddress || undefined,
              unloadingAddress: params.unloadingAddress || undefined,
              status: "active",
            });
            if (pSpec?.specification?.id) {
              specIdsToLink.push(pSpec.specification.id);
            }
          }

          // B. Sale Contract & Specification
          const sContract = await createContractMutation.mutateAsync({
            number: `ДП-${params.deal.number}`,
            counterpartyId: params.deal.buyerId,
            contractKind: "sale",
            type: "framework",
            subject: `Реализация зерна: ${params.deal.cargoName}`,
            amount: vol && sPrice ? String(vol * sPrice) : undefined,
            status: "active",
          });

          if (sContract?.contract?.id) {
            const sSpec = await createSpecificationMutation.mutateAsync({
              number: `СПП-${params.deal.number}`,
              contractId: sContract.contract.id,
              counterpartyId: params.deal.buyerId,
              cargoName: params.deal.cargoName,
              volumeTotal: params.deal.plannedVolume,
              pricePerUnit: params.deal.salePrice,
              loadingAddress: params.loadingAddress || undefined,
              unloadingAddress: params.unloadingAddress || undefined,
              status: "active",
            });
            if (sSpec?.specification?.id) {
              specIdsToLink.push(sSpec.specification.id);
            }
          }

          // C. Carriage Contract (if carrier assigned)
          if (params.deal.carrierId) {
            await createContractMutation.mutateAsync({
              number: `ДЛ-${params.deal.number}`,
              counterpartyId: params.deal.carrierId,
              contractKind: "carriage",
              type: "service",
              subject: `Перевозка зерна: ${params.deal.cargoName}`,
              amount: vol && tPrice ? String(vol * tPrice) : undefined,
              status: "active",
            });
          }
        } catch (docErr) {
          console.error("Auto doc generation error:", docErr);
          toast.error("Сделка создана, но часть документов не сформировалась автоматически");
        }
      }

      // Link specifications to deal
      if (specIdsToLink.length > 0) {
        await syncDealSpecifications(dealId, specIdsToLink);
      }

      await Promise.all([
        utils.deals.list.invalidate(),
        utils.contracts.list.invalidate(),
        utils.specifications.list.invalidate(),
        utils.dashboard.stats.invalidate(),
      ]);

      setDealDeskOpen(false);
      setEditingDealId(null);
      setSelectedDealId(dealId);
      toast.success(editingDealId ? "Сделка обновлена" : "Сделка запущена! Документы сформированы.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить сделку");
    } finally {
      setDealDeskSaving(false);
    }
  }

  async function syncDealSpecifications(dealId: number, specificationIds: number[]) {
    const previouslyLinked = specifications
      .filter((item) => item.specification.dealId === dealId)
      .map((item) => item.specification.id);
    const affectedIds = new Set([...previouslyLinked, ...specificationIds]);
    await Promise.all(Array.from(affectedIds).map((id) => updateSpecificationDeal.mutateAsync({
      id,
      data: { dealId: specificationIds.includes(id) ? dealId : null },
    })));
  }

  async function submitDeal() {
    if (!dealForm.number.trim() || !dealForm.sellerId || !dealForm.buyerId || !dealForm.cargoName.trim()) {
      toast.error("Укажите номер, продавца, покупателя и товар");
      return;
    }
    const data = {
      number: dealForm.number.trim(),
      sellerId: Number(dealForm.sellerId),
      buyerId: Number(dealForm.buyerId),
      carrierId: dealForm.carrierId ? Number(dealForm.carrierId) : null,
      cargoName: dealForm.cargoName.trim(),
      cargoGrade: dealForm.cargoGrade || undefined,
      plannedVolume: dealForm.plannedVolume || undefined,
      purchasePrice: dealForm.purchasePrice || undefined,
      salePrice: dealForm.salePrice || undefined,
      currency: dealForm.currency,
      startDate: dealForm.startDate ? new Date(dealForm.startDate) : undefined,
      endDate: dealForm.endDate ? new Date(dealForm.endDate) : undefined,
      status: dealForm.status,
      notes: dealForm.notes || undefined,
    };
    try {
      const saved = editingDealId
        ? await updateDeal.mutateAsync({ id: editingDealId, data })
        : await createDeal.mutateAsync(data);
      if (!saved) throw new Error("Не удалось сохранить сделку");
      await syncDealSpecifications(saved.id, dealForm.specificationIds);
      await Promise.all([utils.deals.list.invalidate(), utils.specifications.list.invalidate()]);
      setDealFormOpen(false);
      setEditingDealId(null);
      setSelectedDealId(saved.id);
      toast.success(editingDealId ? "Сделка обновлена" : "Сделка создана");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить сделку");
    }
  }

  function submitCounterparty() {
    if (!counterpartyForm.name.trim() || !counterpartyForm.businessRole) {
      toast.error("Укажите наименование и роль контрагента");
      return;
    }
    if (editingCounterpartyId) {
      updateCounterparty.mutate({ id: editingCounterpartyId, data: counterpartyForm });
    } else {
      createCounterparty.mutate(counterpartyForm);
    }
  }

  return (
    <div className="agro-prototype">
      <style>{agroStyles}</style>

      <div className="agro-app">
        <aside className="agro-sidebar">
          <div className="agro-logo">
            Алмаз<span>Агро</span>
          </div>

          <div className="agro-user-badge" style={{ cursor: "default" }}>
            <div className="av">А</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="un truncate">{user?.name || "Администратор"}</div>
              <div className="ur">Полный доступ (Админ)</div>
            </div>
            {logout && (
              <button
                type="button"
                onClick={logout}
                title="Выйти из системы"
                style={{
                  background: "transparent",
                  border: 0,
                  color: "var(--grain-deep)",
                  cursor: "pointer",
                  padding: "4px 6px",
                  borderRadius: "4px",
                  display: "flex",
                  alignItems: "center",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--grain)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--grain-deep)")}
              >
                <LogOut size={14} />
              </button>
            )}
          </div>

          <nav>
            {navItems.map((item) => (
              <button
                type="button"
                key={item.key}
                className={`agro-nav-item ${activeView === item.key ? "active" : ""} ${item.disabled ? "disabled" : ""}`}
                onClick={() => !item.disabled && showView(item.key)}
                disabled={item.disabled}
                title={item.disabled ? "Раздел пока недоступен" : undefined}
              >
                <span className="agro-nav-icon">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <main className="agro-main">
          {activeView === "dashboard" && (
            <section className="agro-view">
              <PageHead
                title="Дашборд"
                subtitle="Оперативная сводка по внесённым договорам, спецификациям и ТТН"
              />
              <div className="agro-kpi-row">
                <Kpi tone="wheat" label="Активные договоры" value={String(dashboardData.activeContracts)} delta={`Всего: ${contracts.length}`} onClick={() => showView("contracts")} />
                <Kpi tone="leaf" label="Спецификации в работе" value={String(dashboardData.openSpecifications)} delta={`Остаток: ${formatTons(dashboardData.remainingVolume)}`} onClick={() => showView("specifications")} />
                <Kpi tone="soil" label="ТТН в пути" value={String(dashboardData.inTransit)} delta={`Плановый вес: ${formatTons(dashboardData.plannedInTransit)}`} onClick={() => showView("ttn")} />
                <Kpi tone="rust" label="Контроль веса" value={String(dashboardData.weightIssues)} delta={`Расхождение: ${formatTons(dashboardData.documentedWeightDifferences)}`} onClick={() => showView("ttn")} />
              </div>
              <div className="agro-dashboard-grid">
                <Panel title="Документы в работе">
                  <ul className="agro-checklist">
                    <li><span className="dot ok" /> Активных договоров: <button type="button" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontWeight: 700, color: "inherit" }} onClick={() => showView("contracts")}>{dashboardData.activeContracts}</button></li>
                    <li><span className="dot ok" /> Открытых спецификаций: <button type="button" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontWeight: 700, color: "inherit" }} onClick={() => showView("specifications")}>{dashboardData.openSpecifications}</button></li>
                    <li><span className={dashboardData.inTransit ? "dot miss" : "dot ok"} /> ТТН в пути: <button type="button" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontWeight: 700, color: "inherit" }} onClick={() => showView("ttn")}>{dashboardData.inTransit}</button></li>
                    <li><span className={dashboardData.weightIssues ? "dot miss" : "dot ok"} /> Закрытых ТТН с замечаниями по весу: <button type="button" style={{ background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", fontWeight: 700, color: "inherit" }} onClick={() => showView("ttn")}>{dashboardData.weightIssues}</button></li>
                  </ul>
                </Panel>
                <Panel title="Требует заполнения">
                  <ul className="agro-checklist">
                    {dashboardData.roleMissing > 0 && <li><span className="dot miss" /> У <b>{dashboardData.roleMissing}</b> контрагентов не назначена роль.</li>}
                    {dashboardData.incompleteCounterparties > 0 && <li><span className="dot miss" /> У <b>{dashboardData.incompleteCounterparties}</b> контрагентов не заполнены обязательные реквизиты.</li>}
                    {dashboardData.contractsWithoutKind > 0 && <li><span className="dot miss" /> У <b>{dashboardData.contractsWithoutKind}</b> договоров не указан вид.</li>}
                    {dashboardData.roleMissing === 0 && dashboardData.incompleteCounterparties === 0 && dashboardData.contractsWithoutKind === 0 && <li><span className="dot ok" /> Карточки и договоры заполнены для текущей модели.</li>}
                  </ul>
                </Panel>
              </div>
              <Panel title="Последние изменения в документах">
                {dashboardData.latestDocuments.length ? (
                  <div className="agro-document-list">
                    {dashboardData.latestDocuments.map((document) => (
                      <div className="agro-document-row" key={`${document.type}-${document.label}-${String(document.createdAt)}`}>
                        <span className="agro-tag">{document.type}</span>
                        <strong>{document.label}</strong>
                        <span>{document.detail}</span>
                        <time>{formatShortDate(document.createdAt)}</time>
                      </div>
                    ))}
                  </div>
                ) : <div className="agro-muted">Документов пока нет.</div>}
              </Panel>
              <Panel title="Контроль веса закрытых ТТН">
                <ul className="agro-checklist">
                  <li><span className={dashboardData.weightIssues ? "dot miss" : "dot ok"} /> ТТН без фактического веса или с расхождением: <b>{dashboardData.weightIssues}</b></li>
                  <li><span className="dot ok" /> Суммарное зафиксированное расхождение: <b>{formatTons(dashboardData.documentedWeightDifferences)}</b></li>
                </ul>
              </Panel>
            </section>
          )}

          {activeView === "deals" && (
            <section className="agro-view">
              <div className="agro-page-head">
                <div>
                  <div className="agro-page-title">Сделки</div>
                  <div className="agro-page-sub">Единый центр: связка закупки, логистики, реализации, ТТН и контроль маржи M</div>
                </div>
                <button type="button" className="agro-btn" onClick={openCreateDeal}>
                  Новая сделка (Deal Desk)
                </button>
              </div>
              {dealsLoading ? <Panel><div className="agro-muted">Загрузка сделок...</div></Panel> : !dealViewModels.length ? (
                <Panel title="Сделок пока нет">
                  <div className="agro-muted">Создайте сделку, затем привяжите к ней спецификации закупки и реализации. Договоры и ТТН появятся в карточке автоматически.</div>
                </Panel>
              ) : (
                <div className="agro-deals-list">
                  {dealViewModels.map((model) => {
                    const seller = counterparties.find((counterparty) => counterparty.id === model.deal.sellerId);
                    const buyer = counterparties.find((counterparty) => counterparty.id === model.deal.buyerId);
                    const completedStages = model.stages.filter((stage) => stage.state === "complete").length;
                    return (
                      <button type="button" key={model.deal.id} className="agro-deal-card" onClick={() => setSelectedDealId(model.deal.id)}>
                        <div className="agro-deal-card-main">
                          <div className="agro-deal-number">Сделка № {model.deal.number}</div>
                          <strong>{model.deal.cargoName}{model.deal.cargoGrade ? ` · ${model.deal.cargoGrade}` : ""}</strong>
                          <span>{formatTons(decimal(model.deal.plannedVolume))} · {seller?.shortName || seller?.name || "Продавец не найден"} → {buyer?.shortName || buyer?.name || "Покупатель не найден"}</span>
                        </div>
                        <div className="agro-deal-progress">
                          <span className={model.weightProblem ? "agro-status-attention" : "agro-status-ok"}>{dealStatusLabel(model.deal.status)}</span>
                          <b>{completedStages}/{model.stages.length} этапов</b>
                          <span>{model.linkedWaybills.length} ТТН</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {activeView === "contractors" && (
            <section className="agro-view">
              <div className="agro-page-head">
                <div>
                  <div className="agro-page-title">Контрагенты</div>
                  <div className="agro-page-sub">Продавцы, покупатели и перевозчики — в одной базе</div>
                </div>
                <div className="agro-head-actions">
                  <button type="button" className="agro-btn ghost" onClick={openOrganizationProfile}>Карточка Алмаз Агро</button>
                  <button type="button" className="agro-btn" onClick={openCreateCounterparty}>＋ Добавить контрагента</button>
                </div>
              </div>
              <Panel title="Собственная организация">
                <div className="agro-organization-summary">
                  <div>
                    <strong>{organizationProfile?.shortName || organizationProfile?.name || "Алмаз Агро"}</strong>
                    <div className="agro-table-secondary">
                      {organizationProfile?.inn ? `ИНН ${organizationProfile.inn}` : "Реквизиты ещё не заполнены"}
                      {organizationProfile?.representativeName ? ` · ${organizationProfile.representativeName}` : ""}
                    </div>
                  </div>
                  <button type="button" className="agro-btn ghost small" onClick={openOrganizationProfile}>Редактировать</button>
                </div>
              </Panel>
              <div className="agro-filter-group">
                <div className="agro-tabs">
                  {([
                    ["all", "Все роли"],
                    ["seller", "Продавцы"],
                    ["buyer", "Покупатели"],
                    ["carrier", "Перевозчики"],
                  ] as Array<[CounterpartyTab, string]>).map(([tab, label]) => (
                    <button
                      type="button"
                      key={tab}
                      className={counterpartyTab === tab ? "active" : ""}
                      onClick={() => setCounterpartyTab(tab)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="agro-tabs agro-tabs-vat">
                  <button
                    type="button"
                    className={counterpartyVatTab === "all" ? "active" : ""}
                    onClick={() => setCounterpartyVatTab("all")}
                  >
                    Все
                  </button>
                  <button
                    type="button"
                    className={counterpartyVatTab === "with_vat" ? "active" : ""}
                    onClick={() => setCounterpartyVatTab("with_vat")}
                  >
                    НДС: Да
                  </button>
                  <button
                    type="button"
                    className={counterpartyVatTab === "without_vat" ? "active" : ""}
                    onClick={() => setCounterpartyVatTab("without_vat")}
                  >
                    НДС: Нет
                  </button>
                </div>
              </div>
              <Panel flush>
                <table className="agro-table">
                  <thead><tr><th>Контрагент</th><th>Роль</th><th>НДС</th><th>Регион</th><th>Профиль</th><th>Статус</th></tr></thead>
                  <tbody>
                    {counterpartiesLoading && <tr><td colSpan={6} className="agro-empty-row">Загрузка контрагентов...</td></tr>}
                    {!counterpartiesLoading && !filteredCounterparties.length && (
                      <tr><td colSpan={6} className="agro-empty-row">В этом разделе пока нет контрагентов. Создайте первую карточку.</td></tr>
                    )}
                    {filteredCounterparties.map((counterparty) => {
                      const isComplete = Boolean(counterparty.inn && counterparty.bankAccount && counterparty.representativeName);
                      const statusKey = (counterparty.status ?? "normal") as CounterpartyStatus;
                      const statusMeta = COUNTERPARTY_STATUSES[statusKey] ?? COUNTERPARTY_STATUSES.normal;
                      return (
                        <tr
                          key={counterparty.id}
                          className="agro-clickable-row"
                          onClick={() => {
                            setSelectedCounterpartyId(counterparty.id);
                            window.history.pushState(null, "", `/counterparties/${counterparty.id}`);
                          }}
                        >
                          <td>
                            <strong>{counterparty.shortName || counterparty.name}</strong>
                            {counterparty.shortName && <div className="agro-table-secondary">{counterparty.name}</div>}
                          </td>
                          <td><span className="agro-tag">{roleLabels[counterparty.businessRole as CounterpartyRole] ?? "Роль не назначена"}</span></td>
                          <td>
                            <span className={`agro-vat-badge ${counterparty.vatType === "without_vat" ? "no-vat" : "vat"}`}>
                              {counterparty.vatType === "without_vat" ? "Нет" : "Да"}
                            </span>
                          </td>
                          <td>{counterparty.region || "—"}</td>
                          <td>{counterparty.profile || "—"}</td>
                          <td>
                            <span className={`agro-status-badge ${statusKey}`}>{statusMeta.label}</span>
                            {!isComplete && <div className="agro-table-secondary agro-status-attention">Нужны реквизиты</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            </section>
          )}

          {activeView === "logistics" && (
            <ReferenceView
              title="Логистика"
              subtitle="Заявки на перевозку и статус рейсов"
              items={["Рейс Р-1001 · #1042 · ИП Дорошенко А.В. · Заявка отправлена", "Рейс Р-1002 · #1048 · перевозчик не подтверждён"]}
            />
          )}

          {activeView === "receivables" && (
            <ReferenceView
              title="Дебиторка по постоплате"
              subtitle="Контроль платежей экспортеров и переработчиков"
              items={["ООО «ЮгЗернОйл» · #1042 · 998 200 ₽ · срок скоро", "АгроЭкспорт Юг · #1044 · просрочено"]}
            />
          )}

          {activeView === "bank" && (
            <ReferenceView
              title="Банк"
              subtitle="Баланс и движение средств по расчётному счёту"
              items={["Баланс р/с · 4 812 300 ₽", "30.06 · Поступление от ЮгЗернОйл", "29.06 · Оплата ООО «Полевой стан»"]}
            />
          )}

          {activeView === "ai-agent" && (
            <ReferenceView
              title="ИИ-агент"
              subtitle="Анализ входящих писем, проверка документов, интеграция почты"
              items={["Анализ письма", "Проверка пакета документов", "Интеграция Mail.ru — требуется backend"]}
            />
          )}

          {activeView === "contracts" && (
            <section className="agro-view agro-ttn-view">
              <div className="agro-page-head">
                <div>
                  <div className="agro-page-title">Договоры</div>
                  <div className="agro-page-sub">Реестр договоров: закупка, реализация и перевозка</div>
                </div>
              </div>
              <div className="agro-live-module">
                <Contracts />
              </div>
            </section>
          )}

          {activeView === "specifications" && (
            <section className="agro-view agro-ttn-view">
              <div className="agro-page-head">
                <div>
                  <div className="agro-page-title">Спецификации</div>
                  <div className="agro-page-sub">Спецификации к договорам с контролем культур, цен, объемов и отгрузок</div>
                </div>
              </div>
              <div className="agro-live-module">
                <Specifications />
              </div>
            </section>
          )}

          {activeView === "ttn" && (
            <section className="agro-view agro-ttn-view">
              <div className="agro-page-head">
                <div>
                  <div className="agro-page-title">Товарно-транспортная накладная</div>
                  <div className="agro-page-sub">Рабочее формирование ТТН из прошлой версии — с печатной формой СП-31 и XLSX</div>
                </div>
              </div>
              <div className="agro-live-module">
                <Waybills />
              </div>
            </section>
          )}
        </main>
      </div>

      {selectedCounterparty && !counterpartyFormOpen && (
        <div className="agro-dialog-backdrop" role="presentation" onMouseDown={closeCounterpartyDialog}>
          <section className="agro-dialog agro-counterparty-card" role="dialog" aria-modal="true" aria-label="Карточка контрагента" onMouseDown={(event) => event.stopPropagation()}>
            <div className="agro-dialog-head">
              <div>
                <div className="agro-dialog-kicker">Карточка контрагента</div>
                <h2>{selectedCounterparty.name}</h2>
                <div className="agro-dialog-badges">
                  <span className="agro-tag">{roleLabels[selectedCounterparty.businessRole as CounterpartyRole] ?? "Роль не назначена"}</span>
                  <span className={`agro-vat-badge ${selectedCounterparty.vatType === "without_vat" ? "no-vat" : "vat"}`}>
                    {selectedCounterparty.vatType === "without_vat" ? "НДС: Нет" : "НДС: Да"}
                  </span>
                </div>
              </div>
              <button type="button" className="agro-icon-button" onClick={closeCounterpartyDialog} aria-label="Закрыть карточку" title="Закрыть">×</button>
            </div>
            <div className="agro-card-actions">
              <button type="button" className="agro-btn ghost small" onClick={openEditCounterparty}>Редактировать</button>
            </div>
            <div className="agro-card-grid">
              <div className="agro-detail-group">
                <h3>Основное</h3>
                <DetailItem label="Краткое наименование" value={selectedCounterparty.shortName} />
                <DetailItem label="НДС" value={selectedCounterparty.vatType === "without_vat" ? "Нет" : "Да"} />
                <DetailItem label="Регион" value={selectedCounterparty.region} />
                <DetailItem label="Профиль" value={selectedCounterparty.profile} />
                <DetailItem label="ИНН" value={selectedCounterparty.inn} />
                <DetailItem label="КПП" value={selectedCounterparty.kpp} />
                <DetailItem label="ОГРН" value={selectedCounterparty.ogrn} />
                <DetailItem label="ОКПО" value={selectedCounterparty.okpo} />
              </div>
              <div className="agro-detail-group">
                <h3>Адреса и банк</h3>
                <DetailItem label="Юридический адрес" value={selectedCounterparty.legalAddress} />
                <DetailItem label="Почтовый адрес" value={selectedCounterparty.postalAddress} />
                <DetailItem label="Фактический адрес" value={selectedCounterparty.actualAddress} />
                <DetailItem label="Пункт погрузки" value={selectedCounterparty.loadingAddress} />
                <DetailItem label="Банк" value={selectedCounterparty.bankName} />
                <DetailItem label="БИК" value={selectedCounterparty.bankBik} />
                <DetailItem label="Расчётный счёт" value={selectedCounterparty.bankAccount} />
                <DetailItem label="Корр. счёт" value={selectedCounterparty.corrAccount} />
              </div>
            </div>
            <div className="agro-counterparty-scans">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Договоры и сканы</h3>
                <button
                  type="button"
                  className="agro-btn compact"
                  onClick={() => {
                    const partyId = selectedCounterparty.id;
                    closeCounterpartyDialog();
                    showView("contracts");
                    window.history.pushState(null, "", `/contracts?counterpartyId=${partyId}&create=1`);
                  }}
                >
                  + Добавить договор
                </button>
              </div>
              {!selectedCounterpartyContracts.length && <div className="agro-muted">У контрагента пока нет договоров.</div>}
              {selectedCounterpartyContracts.map((item) => {
                const contractSpecifications = specifications.filter(
                  (specification) => specification.specification.contractId === item.contract.id
                );
                const activeSpecs = contractSpecifications.filter(
                  (s) => s.specification.status === "active" || s.specification.status === "draft"
                );
                const pastSpecs = contractSpecifications.filter(
                  (s) => s.specification.status === "completed" || s.specification.status === "cancelled"
                );

                const currentFilter = specFilterTabs[item.contract.id] || "all";
                const displayedSpecs =
                  currentFilter === "active"
                    ? activeSpecs
                    : currentFilter === "past"
                    ? pastSpecs
                    : contractSpecifications;

                const totalContractTons = contractSpecifications.reduce(
                  (acc, s) => acc + (Number(s.specification.volumeTotal) || 0),
                  0
                );

                return (
                  <div
                    key={item.contract.id}
                    className="agro-linked-contract"
                    style={{
                      border: "1px solid var(--line)",
                      borderRadius: "10px",
                      padding: "16px",
                      marginBottom: "16px",
                      background: "#fff",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.02)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                    }}
                  >
                    {/* Header: Title, badges, + Добавить спецификацию */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: "12px",
                        flexWrap: "wrap",
                        borderBottom: "1px solid var(--line)",
                        paddingBottom: "12px",
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--soil)" }}>
                            Договор № {item.contract.number}
                          </span>
                          <span className="agro-tag">
                            {item.contract.contractKind === "purchase"
                              ? "Закупка"
                              : item.contract.contractKind === "sale"
                              ? "Реализация"
                              : "Перевозка"}
                          </span>
                          <span
                            style={{
                              fontSize: "11.5px",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              fontWeight: 600,
                              background: item.contract.status === "active" ? "#dcfce7" : "#f1f5f9",
                              color: item.contract.status === "active" ? "#15803d" : "#475569",
                            }}
                          >
                            {item.contract.status === "active"
                              ? "Действует"
                              : item.contract.status === "completed"
                              ? "Завершён"
                              : "Черновик"}
                          </span>
                        </div>
                        {(item.contract.startDate || item.contract.endDate) && (
                          <div style={{ fontSize: "12px", color: "var(--soil-soft)", marginTop: "4px" }}>
                            {item.contract.startDate ? `от ${formatShortDate(item.contract.startDate)}` : ""}
                            {item.contract.endDate ? ` по ${formatShortDate(item.contract.endDate)}` : ""}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="agro-btn compact"
                        style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "7px 14px" }}
                        onClick={() => openAddSpecModal(item.contract, contractSpecifications.length)}
                      >
                        <Plus size={14} /> Добавить спецификацию
                      </button>
                    </div>

                    {/* Scan of the contract */}
                    <ScanAttachments
                      entityType="contract"
                      entityId={item.contract.id}
                      documentKind="contract_scan"
                      title="Скан договора"
                      compact
                    />

                    {/* Specifications Section */}
                    <div style={{ borderTop: "1px dashed var(--line)", paddingTop: "12px" }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "8px",
                          marginBottom: "12px",
                        }}
                      >
                        <div>
                          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--soil)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                            Спецификации к договору
                          </span>
                          {contractSpecifications.length > 0 && (
                            <span style={{ fontSize: "12px", color: "var(--soil-soft)", marginLeft: "8px" }}>
                              · Всего {contractSpecifications.length} шт ({totalContractTons.toLocaleString("ru-RU")} т)
                            </span>
                          )}
                        </div>

                        {/* Filter tabs: Все / Активные / Прошлые */}
                        {contractSpecifications.length > 0 && (
                          <div
                            style={{
                              display: "inline-flex",
                              borderRadius: "6px",
                              border: "1px solid var(--line)",
                              background: "var(--grain-subtle, #f8f6f0)",
                              padding: "2px",
                              gap: "2px",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setSpecFilterTabs((prev) => ({ ...prev, [item.contract.id]: "all" }))}
                              style={{
                                border: "none",
                                background: currentFilter === "all" ? "#fff" : "transparent",
                                color: currentFilter === "all" ? "var(--soil)" : "var(--soil-soft)",
                                fontWeight: currentFilter === "all" ? 700 : 500,
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "11.5px",
                                cursor: "pointer",
                                boxShadow: currentFilter === "all" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                              }}
                            >
                              Все ({contractSpecifications.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setSpecFilterTabs((prev) => ({ ...prev, [item.contract.id]: "active" }))}
                              style={{
                                border: "none",
                                background: currentFilter === "active" ? "#fff" : "transparent",
                                color: currentFilter === "active" ? "#15803d" : "var(--soil-soft)",
                                fontWeight: currentFilter === "active" ? 700 : 500,
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "11.5px",
                                cursor: "pointer",
                                boxShadow: currentFilter === "active" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                              }}
                            >
                              Активные ({activeSpecs.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setSpecFilterTabs((prev) => ({ ...prev, [item.contract.id]: "past" }))}
                              style={{
                                border: "none",
                                background: currentFilter === "past" ? "#fff" : "transparent",
                                color: currentFilter === "past" ? "#0369a1" : "var(--soil-soft)",
                                fontWeight: currentFilter === "past" ? 700 : 500,
                                borderRadius: "4px",
                                padding: "4px 8px",
                                fontSize: "11.5px",
                                cursor: "pointer",
                                boxShadow: currentFilter === "past" ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                              }}
                            >
                              Прошлые ({pastSpecs.length})
                            </button>
                          </div>
                        )}
                      </div>

                      {!displayedSpecs.length ? (
                        <div
                          style={{
                            padding: "16px",
                            background: "var(--grain-subtle, #f8f6f0)",
                            borderRadius: "8px",
                            border: "1px dashed var(--line)",
                            textAlign: "center",
                            fontSize: "13px",
                            color: "var(--soil-soft)",
                          }}
                        >
                          {contractSpecifications.length === 0 ? (
                            <div>
                              <div>К этому договору пока не добавлено ни одной спецификации.</div>
                              <button
                                type="button"
                                className="agro-btn compact"
                                style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "6px" }}
                                onClick={() => openAddSpecModal(item.contract, 0)}
                              >
                                <Plus size={14} /> Добавить первую спецификацию
                              </button>
                            </div>
                          ) : (
                            <div>В этой категории нет спецификаций.</div>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {displayedSpecs.map((specItem) => {
                            const spec = specItem.specification;
                            const isActive = spec.status === "active" || spec.status === "draft";
                            const vol = Number(spec.volumeTotal) || 0;
                            const price = Number(spec.pricePerUnit) || 0;
                            const totalAmount = vol > 0 && price > 0 ? vol * price : 0;
                            return (
                              <div
                                key={spec.id}
                                style={{
                                  border: "1px solid var(--line)",
                                  borderRadius: "8px",
                                  padding: "12px 14px",
                                  background: isActive ? "#ffffff" : "#fbfcfb",
                                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "10px",
                                }}
                              >
                                {/* Top row: Number, Status badge, Quick Status selector & Edit button */}
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ fontWeight: 700, fontSize: "14.5px", color: "var(--soil)" }}>
                                      Спецификация № {spec.number}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: "11px",
                                        padding: "2px 8px",
                                        borderRadius: "12px",
                                        fontWeight: 600,
                                        background:
                                          spec.status === "active"
                                            ? "#dcfce7"
                                            : spec.status === "completed"
                                            ? "#e0f2fe"
                                            : spec.status === "cancelled"
                                            ? "#fee2e2"
                                            : "#f1f5f9",
                                        color:
                                          spec.status === "active"
                                            ? "#15803d"
                                            : spec.status === "completed"
                                            ? "#0369a1"
                                            : spec.status === "cancelled"
                                            ? "#b91c1c"
                                            : "#475569",
                                      }}
                                    >
                                      {spec.status === "active"
                                        ? "Активна (в работе)"
                                        : spec.status === "completed"
                                        ? "Исполнена (прошлая)"
                                        : spec.status === "cancelled"
                                        ? "Отменена"
                                        : "Черновик"}
                                    </span>
                                  </div>

                                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                    <select
                                      value={spec.status}
                                      onChange={(e) => updateSpecStatusMutation.mutate({ id: spec.id, status: e.target.value as any })}
                                      style={{
                                        fontSize: "11.5px",
                                        padding: "4px 8px",
                                        borderRadius: "5px",
                                        border: "1px solid var(--line)",
                                        background: "#fff",
                                        color: "var(--soil)",
                                        cursor: "pointer",
                                      }}
                                      title="Быстро сменить статус спецификации"
                                    >
                                      <option value="active">Активна</option>
                                      <option value="completed">Исполнена</option>
                                      <option value="draft">Черновик</option>
                                      <option value="cancelled">Отменена</option>
                                    </select>

                                    <button
                                      type="button"
                                      className="agro-btn ghost compact"
                                      style={{ padding: "4px 8px", fontSize: "11.5px" }}
                                      onClick={() =>
                                        openEditSpecModal(item.contract, {
                                          id: spec.id,
                                          number: spec.number,
                                          cargoName: spec.cargoName,
                                          volumeTotal: spec.volumeTotal,
                                          pricePerUnit: spec.pricePerUnit,
                                          status: spec.status,
                                          notes: spec.notes,
                                          loadingAddress: spec.loadingAddress,
                                          unloadingAddress: spec.unloadingAddress,
                                        })
                                      }
                                    >
                                      Редактировать
                                    </button>
                                  </div>
                                </div>

                                {/* Middle row: Tonnage, Price, Cargo, Total Sum */}
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                                    gap: "10px",
                                    padding: "10px 12px",
                                    background: "var(--grain-subtle, #f8f6f0)",
                                    borderRadius: "6px",
                                    fontSize: "12px",
                                  }}
                                >
                                  <div>
                                    <div style={{ color: "var(--soil-soft)", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>
                                      Товар / Культура
                                    </div>
                                    <div style={{ fontWeight: 600, color: "var(--soil)", marginTop: "2px" }}>
                                      {spec.cargoName || "Товар не указан"}
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ color: "var(--soil-soft)", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>
                                      Тоннаж
                                    </div>
                                    <div style={{ fontWeight: 700, color: "var(--soil)", fontSize: "14px", marginTop: "2px" }}>
                                      {vol > 0 ? `${vol.toLocaleString("ru-RU")} т` : "—"}
                                    </div>
                                    {spec.volumeShipped && Number(spec.volumeShipped) > 0 && (
                                      <div style={{ fontSize: "11px", color: "var(--soil-soft)" }}>
                                        отгружено {Number(spec.volumeShipped).toLocaleString("ru-RU")} т
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <div style={{ color: "var(--soil-soft)", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>
                                      Цена за тонну
                                    </div>
                                    <div style={{ fontWeight: 700, color: "var(--soil)", fontSize: "14px", marginTop: "2px" }}>
                                      {price > 0 ? `${price.toLocaleString("ru-RU")} ₽/т` : "—"}
                                    </div>
                                  </div>

                                  <div>
                                    <div style={{ color: "var(--soil-soft)", fontSize: "11px", textTransform: "uppercase", fontWeight: 600 }}>
                                      Сумма спецификации
                                    </div>
                                    <div style={{ fontWeight: 700, color: "var(--soil)", fontSize: "14px", marginTop: "2px" }}>
                                      {totalAmount > 0 ? `${totalAmount.toLocaleString("ru-RU")} ₽` : "—"}
                                    </div>
                                  </div>
                                </div>

                                {/* Bottom row: Scan Attachments */}
                                <div>
                                  <ScanAttachments
                                    entityType="contract"
                                    entityId={item.contract.id}
                                    documentKind="specification_scan"
                                    specificationId={spec.id}
                                    title={`Скан спецификации № ${spec.number}`}
                                    compact
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="agro-counterparty-scans" style={{ marginTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>Накладные (ТТН)</h3>
                <button
                  type="button"
                  className="agro-btn compact"
                  onClick={() => {
                    const partyId = selectedCounterparty.id;
                    closeCounterpartyDialog();
                    showView("ttn");
                    window.history.pushState(null, "", `/ttn?counterpartyId=${partyId}&create=1`);
                  }}
                >
                  + Оформить ТТН
                </button>
              </div>
              {!selectedCounterpartyWaybills.length && <div className="agro-muted">Связанных ТТН пока нет.</div>}
              {selectedCounterpartyWaybills.map((w) => (
                <div key={w.id} className="agro-linked-contract" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="agro-linked-contract-title">ТТН № {w.number}</div>
                    <div className="agro-muted" style={{ fontSize: "12px" }}>
                      Груз: {w.cargoName || "—"} | Нетто: {w.netWeight ? `${w.netWeight} т` : "—"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className={`agro-status-badge ${w.status}`}>
                      {w.status === "in_transit" ? "В пути" : w.status === "delivered" ? "Доставлена" : w.status === "cancelled" ? "Отменена" : "Черновик"}
                    </span>
                    <a
                      href={`/api/waybills/${w.id}/print`}
                      target="_blank"
                      rel="noreferrer"
                      className="agro-btn ghost compact"
                      style={{ textDecoration: "none" }}
                    >
                      СП-31 ↗
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {selectedDeal && !dealDeskOpen && !dealFormOpen && (
        <div className="agro-dialog-backdrop" role="presentation" onMouseDown={() => setSelectedDealId(null)}>
          <section className="agro-dialog agro-deal-dialog" role="dialog" aria-modal="true" aria-label="Карточка сделки" onMouseDown={(event) => event.stopPropagation()}>
            <div className="agro-dialog-head">
              <div>
                <div className="agro-dialog-kicker">Сделка № {selectedDeal.deal.number}</div>
                <h2>{selectedDeal.deal.cargoName}{selectedDeal.deal.cargoGrade ? ` · ${selectedDeal.deal.cargoGrade}` : ""}</h2>
                <span className={selectedDeal.weightProblem ? "agro-status-attention" : "agro-status-ok"}>{dealStatusLabel(selectedDeal.deal.status)}</span>
              </div>
              <button type="button" className="agro-icon-button" onClick={() => setSelectedDealId(null)} aria-label="Закрыть карточку" title="Закрыть">×</button>
            </div>
            <div className="agro-card-actions">
              <button type="button" className="agro-btn ghost small" onClick={() => openEditDeal(selectedDeal.deal.id)}>Редактировать в Deal Desk</button>
            </div>

            {/* Formula M Banner */}
            {(() => {
              const pPrice = Number(selectedDeal.deal.purchasePrice) || 0;
              const sPrice = Number(selectedDeal.deal.salePrice) || 0;
              const vol = Number(selectedDeal.deal.plannedVolume) || 0;
              const tariffMatch = selectedDeal.deal.notes?.match(/Тариф перевозки:\s*(\d+(?:\.\d+)?)/i);
              const cTariff = tariffMatch ? Number(tariffMatch[1]) : 1500;
              const mPerTon = sPrice - pPrice - cTariff;
              const planProfit = mPerTon * vol;
              const isProfit = mPerTon > 0;
              return (
                <div
                  style={{
                    background: isProfit ? "#F0FDF4" : "#FEF2F2",
                    border: `1.5px solid ${isProfit ? "#86EFAC" : "#FCA5A5"}`,
                    borderRadius: "10px",
                    padding: "14px 18px",
                    margin: "14px 0",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <strong style={{ fontSize: "12px", color: "var(--soil)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calculator size={15} style={{ color: "var(--wheat)" }} />
                      ФОРМУЛА МАРЖИ: M = (Дог П. - ТТН - Дог З.) / Тонн
                    </strong>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: isProfit ? "#15803D" : "#DC2626" }}>
                      Маржа M: {mPerTon >= 0 ? "+" : ""}{mPerTon.toLocaleString("ru-RU")} ₽/т
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "8px", fontSize: "12px" }}>
                    <div><span style={{ color: "var(--soil-soft)", fontSize: "10.5px" }}>ВЫРУЧКА (П)</span><br /><b>{(vol * sPrice).toLocaleString("ru-RU")} ₽</b></div>
                    <div><span style={{ color: "var(--soil-soft)", fontSize: "10.5px" }}>ЗАКУПКА (З)</span><br /><b>{(vol * pPrice).toLocaleString("ru-RU")} ₽</b></div>
                    <div><span style={{ color: "var(--soil-soft)", fontSize: "10.5px" }}>ПЕРЕВОЗКА (ТТН)</span><br /><b>{(vol * cTariff).toLocaleString("ru-RU")} ₽</b></div>
                    <div><span style={{ color: "var(--soil-soft)", fontSize: "10.5px" }}>ПЛАНОВАЯ ПРИБЫЛЬ</span><br /><b style={{ color: isProfit ? "#15803D" : "#DC2626" }}>{planProfit >= 0 ? "+" : ""}{planProfit.toLocaleString("ru-RU")} ₽</b></div>
                  </div>
                </div>
              );
            })()}

            <div className="agro-deal-summary">
              <DetailItem label="Продавец" value={counterparties.find((counterparty) => counterparty.id === selectedDeal.deal.sellerId)?.shortName || counterparties.find((counterparty) => counterparty.id === selectedDeal.deal.sellerId)?.name} />
              <DetailItem label="Покупатель" value={counterparties.find((counterparty) => counterparty.id === selectedDeal.deal.buyerId)?.shortName || counterparties.find((counterparty) => counterparty.id === selectedDeal.deal.buyerId)?.name} />
              <DetailItem label="Перевозчик" value={counterparties.find((counterparty) => counterparty.id === selectedDeal.deal.carrierId)?.shortName || counterparties.find((counterparty) => counterparty.id === selectedDeal.deal.carrierId)?.name} />
              <DetailItem label="Плановый объём" value={formatTons(decimal(selectedDeal.deal.plannedVolume))} />
              <DetailItem label="Цена закупки" value={formatDealPrice(selectedDeal.deal.purchasePrice, selectedDeal.deal.currency)} />
              <DetailItem label="Цена реализации" value={formatDealPrice(selectedDeal.deal.salePrice, selectedDeal.deal.currency)} />
            </div>
            <div className="agro-deal-section">
              <h3>Этапы сделки</h3>
              <div className="agro-deal-stages">
                {selectedDeal.stages.map((stage, index) => (
                  <div key={stage.title} className={`agro-deal-stage ${stage.state}`}>
                    <span>{index + 1}</span>
                    <div><b>{stage.title}</b><small>{stage.detail}</small></div>
                    <strong>{stage.state === "complete" ? "Готово" : stage.state === "attention" ? "Внимание" : "Ожидается"}</strong>
                  </div>
                ))}
              </div>
            </div>
            <div className="agro-deal-section">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <h3 style={{ margin: 0 }}>Рейсы и товарно-транспортные накладные</h3>
                <button
                  type="button"
                  className="agro-btn small"
                  style={{ gap: "6px" }}
                  onClick={() => {
                    setSelectedDealId(null);
                    showView("ttn");
                  }}
                >
                  <Truck size={13} />
                  ＋ Оформить ТТН
                </button>
              </div>
              <div className="agro-linked-documents">
                <div><span>Договоров</span><b>{selectedDeal.linkedContracts.length}</b></div>
                <div><span>Спецификаций</span><b>{selectedDeal.linkedSpecifications.length}</b></div>
                <div><span>Всего ТТН</span><b>{selectedDeal.linkedWaybills.length}</b></div>
                <div><span>Перевозчиков</span><b>{new Set(selectedDeal.linkedWaybills.map((w) => w.carrierName || w.carrierId).filter(Boolean)).size || (selectedDeal.deal.carrierId ? 1 : 0)}</b></div>
              </div>
              {!selectedDeal.linkedSpecifications.length ? <div className="agro-muted">Привяжите спецификации в режиме редактирования: по ним в сделку попадут договоры и ТТН.</div> : (
                <div className="agro-linked-document-list">
                  {selectedDeal.linkedSpecifications.map((item) => (
                    <div key={item.specification.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>Спецификация № {item.specification.number} · {item.specification.cargoName || "Груз не указан"}</span>
                      <small style={{ color: "var(--soil-soft)" }}>
                        {item.specification.pricePerUnit ? `${item.specification.pricePerUnit} ₽/т` : ""}
                      </small>
                    </div>
                  ))}
                  {selectedDeal.linkedWaybills.map((waybill) => (
                    <div key={waybill.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px dashed var(--line)" }}>
                      <div>
                        <div>
                          <b>ТТН № {waybill.number}</b>{waybill.netWeight ? ` · ${waybill.netWeight} т` : ""} · <span style={{ color: "var(--soil-soft)" }}>{waybill.status === "delivered" ? "доставлена" : waybill.status === "in_transit" ? "в пути" : "черновик"}</span>
                        </div>
                        <div style={{ fontSize: "12px", color: "var(--soil-soft)", marginTop: "2px" }}>
                          {waybill.carrierName || "Перевозчик не назначен"}{waybill.driverName ? ` · Водитель: ${waybill.driverName}` : ""}{waybill.tractorNumber ? ` (${waybill.tractorNumber})` : ""}
                        </div>
                      </div>
                      <a href={`/api/waybills/${waybill.id}/print`} target="_blank" rel="noreferrer" className="agro-btn ghost compact" style={{ textDecoration: "none" }}>
                        СП-31 ↗
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      <DealDeskModal
        open={dealDeskOpen}
        onClose={() => {
          setDealDeskOpen(false);
          setEditingDealId(null);
        }}
        editingDealId={editingDealId}
        initialDeal={dealDeskInitial}
        counterparties={counterparties}
        specifications={specifications}
        contracts={contracts}
        saving={dealDeskSaving}
        onSubmit={handleDealDeskSubmit}
        onOpenCreateCounterparty={(role) => {
          setCounterpartyForm({
            ...emptyCounterpartyForm,
            businessRole: role,
          });
          setCounterpartyFormOpen(true);
        }}
      />

      <AddContractSpecificationModal
        open={specModalOpen}
        onClose={() => {
          setSpecModalOpen(false);
          setSpecModalContract(null);
          setSpecModalEditing(null);
        }}
        contract={specModalContract}
        counterpartyName={selectedCounterparty?.shortName || selectedCounterparty?.name}
        nextNumber={specModalNextNumber}
        editingSpec={specModalEditing}
      />

      {counterpartyFormOpen && (
        <CounterpartyFormModal
          form={counterpartyForm}
          editing={Boolean(editingCounterpartyId)}
          saving={createCounterparty.isPending || updateCounterparty.isPending}
          onChange={setCounterpartyForm}
          onClose={() => {
            setCounterpartyFormOpen(false);
            setEditingCounterpartyId(null);
          }}
          onSubmit={submitCounterparty}
        />
      )}

      {dealFormOpen && (
        <DealFormModal
          form={dealForm}
          editing={Boolean(editingDealId)}
          saving={createDeal.isPending || updateDeal.isPending || updateSpecificationDeal.isPending}
          counterparties={counterparties}
          specifications={specifications}
          contracts={contracts}
          onChange={setDealForm}
          onClose={() => {
            setDealFormOpen(false);
            setEditingDealId(null);
          }}
          onSubmit={submitDeal}
          onOpenSpecifications={() => showView("specifications")}
        />
      )}

      {organizationFormOpen && (
        <OrganizationProfileModal
          form={organizationForm}
          saving={saveOrganizationProfile.isPending}
          onChange={setOrganizationForm}
          onClose={() => setOrganizationFormOpen(false)}
          onSubmit={() => saveOrganizationProfile.mutate(organizationForm)}
        />
      )}
    </div>
  );
}

function decimal(value: string | number | null | undefined) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTons(value: number) {
  return `${value.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 3 })} т`;
}

function formatShortDate(value: Date | string) {
  return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DetailItem({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="agro-detail-item">
      <span>{label}</span>
      <b>{value || "—"}</b>
    </div>
  );
}

function dealStatusLabel(status: DealStatus) {
  return {
    planning: "Подготовка",
    active: "В работе",
    closing: "Закрытие",
    completed: "Завершена",
    cancelled: "Отменена",
  }[status];
}

function formatDealPrice(value: string | null, currency: string | null) {
  if (value === null) return "—";
  return `${Number(value).toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${currency || "RUB"}/т`;
}

function DealFormModal({
  form,
  editing,
  saving,
  counterparties,
  specifications,
  contracts,
  onChange,
  onClose,
  onSubmit,
  onOpenSpecifications,
}: {
  form: DealFormState;
  editing: boolean;
  saving: boolean;
  counterparties: Array<{ id: number; name: string; shortName: string | null; businessRole: string | null }>;
  specifications: Array<{ specification: { id: number; number: string; dealId: number | null; contractId: number; cargoName: string | null } }>;
  contracts: Array<{ contract: { id: number; number: string; contractKind: "purchase" | "sale" | "carriage" | null } }>;
  onChange: (form: DealFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
  onOpenSpecifications?: () => void;
}) {
  const setField = (key: Exclude<keyof DealFormState, "specificationIds">, value: string) => onChange({ ...form, [key]: value });
  const toggleSpecification = (id: number) => onChange({
    ...form,
    specificationIds: form.specificationIds.includes(id)
      ? form.specificationIds.filter((item) => item !== id)
      : [...form.specificationIds, id],
  });
  const sellerOptions = counterparties.filter((counterparty) => counterparty.businessRole === "seller");
  const buyerOptions = counterparties.filter((counterparty) => counterparty.businessRole === "buyer");
  const carrierOptions = counterparties.filter((counterparty) => counterparty.businessRole === "carrier");

  return (
    <div className="agro-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="agro-dialog agro-deal-form" role="dialog" aria-modal="true" aria-label="Карточка сделки" onMouseDown={(event) => event.stopPropagation()}>
        <div className="agro-dialog-head">
          <div><div className="agro-dialog-kicker">Сделки</div><h2>{editing ? "Редактировать сделку" : "Новая сделка"}</h2></div>
          <button type="button" className="agro-icon-button" onClick={onClose} aria-label="Закрыть форму" title="Закрыть">×</button>
        </div>
        <div className="agro-form-section">
          <h3>Условия сделки</h3>
          <div className="agro-form-grid">
            <label className="agro-field"><span>Номер сделки *</span><input value={form.number} onChange={(event) => setField("number", event.target.value)} placeholder="СД-0001" /></label>
            <label className="agro-field"><span>Статус</span><select value={form.status} onChange={(event) => setField("status", event.target.value)}><option value="planning">Подготовка</option><option value="active">В работе</option><option value="closing">Закрытие</option><option value="completed">Завершена</option><option value="cancelled">Отменена</option></select></label>
            <label className="agro-field"><span>Продавец *</span><select value={form.sellerId} onChange={(event) => setField("sellerId", event.target.value)}><option value="">Выберите продавца</option>{sellerOptions.map((counterparty) => <option key={counterparty.id} value={counterparty.id}>{counterparty.shortName || counterparty.name}</option>)}</select></label>
            <label className="agro-field"><span>Покупатель *</span><select value={form.buyerId} onChange={(event) => setField("buyerId", event.target.value)}><option value="">Выберите покупателя</option>{buyerOptions.map((counterparty) => <option key={counterparty.id} value={counterparty.id}>{counterparty.shortName || counterparty.name}</option>)}</select></label>
            <label className="agro-field"><span>Перевозчик</span><select value={form.carrierId} onChange={(event) => setField("carrierId", event.target.value)}><option value="">Назначить позднее</option>{carrierOptions.map((counterparty) => <option key={counterparty.id} value={counterparty.id}>{counterparty.shortName || counterparty.name}</option>)}</select></label>
            <label className="agro-field"><span>Плановая дата начала</span><input type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} /></label>
            <label className="agro-field agro-field-wide"><span>Товар *</span><input value={form.cargoName} onChange={(event) => setField("cargoName", event.target.value)} placeholder="Пшеница" /></label>
            <label className="agro-field"><span>Класс / сорт</span><input value={form.cargoGrade} onChange={(event) => setField("cargoGrade", event.target.value)} placeholder="3 класс" /></label>
            <label className="agro-field"><span>Плановый объём, т</span><input inputMode="decimal" value={form.plannedVolume} onChange={(event) => setField("plannedVolume", event.target.value)} /></label>
            <label className="agro-field"><span>Цена закупки, за т</span><input inputMode="decimal" value={form.purchasePrice} onChange={(event) => setField("purchasePrice", event.target.value)} /></label>
            <label className="agro-field"><span>Цена реализации, за т</span><input inputMode="decimal" value={form.salePrice} onChange={(event) => setField("salePrice", event.target.value)} /></label>
          </div>
        </div>
        <div className="agro-form-section">
          <h3>Спецификации сделки</h3>
          <div className="agro-muted">Отметьте спецификации закупки и реализации. По ним сделка автоматически соберёт договоры и ТТН.</div>
          <div className="agro-specification-picker">
            {!specifications.length ? (
              <div className="agro-muted">
                Сначала создайте спецификации в{" "}
                <button
                  type="button"
                  style={{ textDecoration: "underline", color: "var(--wheat)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                  onClick={() => {
                    onClose();
                    onOpenSpecifications?.();
                  }}
                >
                  разделе «Спецификации»
                </button>.
              </div>
            ) : specifications.map((item) => {
              const contract = contracts.find((row) => row.contract.id === item.specification.contractId)?.contract;
              return (
                <label key={item.specification.id} className="agro-specification-option">
                  <input type="checkbox" checked={form.specificationIds.includes(item.specification.id)} onChange={() => toggleSpecification(item.specification.id)} />
                  <span><b>№ {item.specification.number}</b> · {item.specification.cargoName || "Груз не указан"}<small>{contract ? `Договор № ${contract.number} · ${contract.contractKind === "purchase" ? "закупка" : contract.contractKind === "sale" ? "реализация" : contract.contractKind === "carriage" ? "перевозка" : "вид не указан"}` : "Договор не найден"}{item.specification.dealId && !form.specificationIds.includes(item.specification.id) ? " · уже связана с другой сделкой" : ""}</small></span>
                </label>
              );
            })}
          </div>
        </div>
        <div className="agro-form-section"><label className="agro-field"><span>Примечание</span><textarea rows={3} value={form.notes} onChange={(event) => setField("notes", event.target.value)} /></label></div>
        <div className="agro-dialog-footer"><button type="button" className="agro-btn ghost" onClick={onClose}>Отмена</button><button type="button" className="agro-btn" disabled={saving} onClick={onSubmit}>{editing ? "Сохранить" : "Создать сделку"}</button></div>
      </section>
    </div>
  );
}

function CounterpartyFormModal({
  form,
  editing,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: CounterpartyFormState;
  editing: boolean;
  saving: boolean;
  onChange: (form: CounterpartyFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const setField = (key: keyof CounterpartyFormState, value: string) => onChange({ ...form, [key]: value });

  return (
    <div className="agro-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="agro-dialog agro-counterparty-form" role="dialog" aria-modal="true" aria-label="Карточка контрагента" onMouseDown={(event) => event.stopPropagation()}>
        <div className="agro-dialog-head">
          <div>
            <div className="agro-dialog-kicker">Контрагенты</div>
            <h2>{editing ? "Редактировать карточку" : "Новый контрагент"}</h2>
          </div>
          <button type="button" className="agro-icon-button" onClick={onClose} aria-label="Закрыть форму" title="Закрыть">×</button>
        </div>

        <div className="agro-form-section">
          <h3>Основное</h3>
          <div className="agro-form-grid">
            <label className="agro-field agro-field-wide"><span>Полное наименование *</span><input value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="ООО «Компания»" /></label>
            <label className="agro-field"><span>Краткое наименование</span><input value={form.shortName} onChange={(event) => setField("shortName", event.target.value)} /></label>
            <label className="agro-field"><span>Организационная форма</span><select value={form.type} onChange={(event) => setField("type", event.target.value)}><option value="legal">ООО / АО / ПАО</option><option value="sole_trader">ИП</option><option value="individual">Физическое лицо</option></select></label>
            <label className="agro-field"><span>Роль в цепочке</span><select value={form.businessRole} onChange={(event) => setField("businessRole", event.target.value)}>{Object.entries(roleLabels).map(([role, label]) => <option value={role} key={role}>{label}</option>)}</select></label>
            <label className="agro-field"><span>Система налогообложения</span><select value={form.vatType} onChange={(event) => setField("vatType", event.target.value)}><option value="with_vat">С НДС (ОСНО)</option><option value="without_vat">Без НДС (УСН)</option></select></label>
            <label className="agro-field"><span>Статус</span><select value={form.status} onChange={(event) => setField("status", event.target.value)}>{Object.entries(COUNTERPARTY_STATUSES).map(([value, status]) => <option key={value} value={value}>{status.label}</option>)}</select></label>
            <label className="agro-field"><span>Регион</span><input value={form.region} onChange={(event) => setField("region", event.target.value)} placeholder="Ставропольский край" /></label>
            <label className="agro-field agro-field-wide"><span>Профиль продукции / услуг</span><input value={form.profile} onChange={(event) => setField("profile", event.target.value)} placeholder="Пшеница, ячмень или автоперевозки" /></label>
          </div>
        </div>

        <div className="agro-form-section">
          <h3>Реквизиты</h3>
          <div className="agro-form-grid agro-form-grid-four">
            <label className="agro-field"><span>ИНН</span><input value={form.inn} maxLength={12} onChange={(event) => setField("inn", event.target.value)} /></label>
            <label className="agro-field"><span>КПП</span><input value={form.kpp} maxLength={9} onChange={(event) => setField("kpp", event.target.value)} /></label>
            <label className="agro-field"><span>ОГРН / ОГРНИП</span><input value={form.ogrn} maxLength={15} onChange={(event) => setField("ogrn", event.target.value)} /></label>
            <label className="agro-field"><span>ОКПО</span><input value={form.okpo} maxLength={10} onChange={(event) => setField("okpo", event.target.value)} /></label>
          </div>
        </div>

        <div className="agro-form-section">
          <h3>Представитель и контакты</h3>
          <div className="agro-form-grid">
            <label className="agro-field"><span>ФИО представителя</span><input value={form.representativeName} onChange={(event) => setField("representativeName", event.target.value)} /></label>
            <label className="agro-field"><span>Должность</span><input value={form.representativePosition} onChange={(event) => setField("representativePosition", event.target.value)} placeholder="Генеральный директор" /></label>
            <label className="agro-field agro-field-wide"><span>Основание полномочий</span><input value={form.authorityBasis} onChange={(event) => setField("authorityBasis", event.target.value)} placeholder="Устав или доверенность №..." /></label>
            <label className="agro-field"><span>Телефон</span><input value={form.phone} onChange={(event) => setField("phone", event.target.value)} /></label>
            <label className="agro-field"><span>Email</span><input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} /></label>
          </div>
        </div>

        <div className="agro-form-section">
          <h3>Адреса</h3>
          <div className="agro-form-grid">
            <label className="agro-field agro-field-wide"><span>Юридический адрес</span><input value={form.legalAddress} onChange={(event) => setField("legalAddress", event.target.value)} /></label>
            <label className="agro-field agro-field-wide"><span>Почтовый адрес</span><input value={form.postalAddress} onChange={(event) => setField("postalAddress", event.target.value)} /></label>
            <label className="agro-field agro-field-wide"><span>Фактический адрес</span><input value={form.actualAddress} onChange={(event) => setField("actualAddress", event.target.value)} /></label>
            <label className="agro-field agro-field-wide"><span>Пункт погрузки</span><input value={form.loadingAddress} onChange={(event) => setField("loadingAddress", event.target.value)} placeholder="Элеватор, склад, адрес отгрузки" /></label>
          </div>
        </div>

        <div className="agro-form-section">
          <h3>Банковские реквизиты</h3>
          <div className="agro-form-grid">
            <label className="agro-field agro-field-wide"><span>Наименование банка</span><input value={form.bankName} onChange={(event) => setField("bankName", event.target.value)} /></label>
            <label className="agro-field"><span>БИК</span><input value={form.bankBik} maxLength={9} onChange={(event) => setField("bankBik", event.target.value)} /></label>
            <label className="agro-field"><span>Расчётный счёт</span><input value={form.bankAccount} maxLength={20} onChange={(event) => setField("bankAccount", event.target.value)} /></label>
            <label className="agro-field agro-field-wide"><span>Корреспондентский счёт</span><input value={form.corrAccount} maxLength={20} onChange={(event) => setField("corrAccount", event.target.value)} /></label>
          </div>
        </div>

        <div className="agro-form-section">
          <label className="agro-field agro-field-wide"><span>Примечания</span><textarea value={form.notes} onChange={(event) => setField("notes", event.target.value)} rows={3} /></label>
        </div>
        <div className="agro-dialog-footer">
          <button type="button" className="agro-btn ghost" onClick={onClose}>Отмена</button>
          <button type="button" className="agro-btn" disabled={saving} onClick={onSubmit}>{editing ? "Сохранить" : "Создать карточку"}</button>
        </div>
      </section>
    </div>
  );
}

function OrganizationProfileModal({
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: OrganizationFormState;
  saving: boolean;
  onChange: (form: OrganizationFormState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const setField = (key: keyof OrganizationFormState, value: string) => onChange({ ...form, [key]: value });
  return (
    <div className="agro-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="agro-dialog agro-counterparty-form" role="dialog" aria-modal="true" aria-label="Карточка собственной организации" onMouseDown={(event) => event.stopPropagation()}>
        <div className="agro-dialog-head">
          <div><div className="agro-dialog-kicker">Настройки</div><h2>Собственная организация</h2></div>
          <button type="button" className="agro-icon-button" onClick={onClose} aria-label="Закрыть форму" title="Закрыть">×</button>
        </div>
        <div className="agro-form-section">
          <h3>Реквизиты организации</h3>
          <div className="agro-form-grid">
            <label className="agro-field agro-field-wide"><span>Полное наименование *</span><input value={form.name} onChange={(event) => setField("name", event.target.value)} /></label>
            <label className="agro-field"><span>Краткое наименование</span><input value={form.shortName} onChange={(event) => setField("shortName", event.target.value)} /></label>
            <label className="agro-field"><span>ИНН</span><input value={form.inn} maxLength={12} onChange={(event) => setField("inn", event.target.value)} /></label>
            <label className="agro-field"><span>КПП</span><input value={form.kpp} maxLength={9} onChange={(event) => setField("kpp", event.target.value)} /></label>
            <label className="agro-field"><span>ОГРН</span><input value={form.ogrn} maxLength={15} onChange={(event) => setField("ogrn", event.target.value)} /></label>
          </div>
        </div>
        <div className="agro-form-section">
          <h3>Подписант и контакты</h3>
          <div className="agro-form-grid">
            <label className="agro-field"><span>ФИО представителя</span><input value={form.representativeName} onChange={(event) => setField("representativeName", event.target.value)} /></label>
            <label className="agro-field"><span>Должность</span><input value={form.representativePosition} onChange={(event) => setField("representativePosition", event.target.value)} /></label>
            <label className="agro-field agro-field-wide"><span>Основание полномочий</span><input value={form.authorityBasis} onChange={(event) => setField("authorityBasis", event.target.value)} /></label>
            <label className="agro-field"><span>Телефон</span><input value={form.phone} onChange={(event) => setField("phone", event.target.value)} /></label>
            <label className="agro-field"><span>Email</span><input type="email" value={form.email} onChange={(event) => setField("email", event.target.value)} /></label>
          </div>
        </div>
        <div className="agro-form-section">
          <h3>Адреса и банк</h3>
          <div className="agro-form-grid">
            <label className="agro-field agro-field-wide"><span>Юридический адрес</span><input value={form.legalAddress} onChange={(event) => setField("legalAddress", event.target.value)} /></label>
            <label className="agro-field agro-field-wide"><span>Почтовый адрес</span><input value={form.postalAddress} onChange={(event) => setField("postalAddress", event.target.value)} /></label>
            <label className="agro-field agro-field-wide"><span>Наименование банка</span><input value={form.bankName} onChange={(event) => setField("bankName", event.target.value)} /></label>
            <label className="agro-field"><span>БИК</span><input value={form.bankBik} maxLength={9} onChange={(event) => setField("bankBik", event.target.value)} /></label>
            <label className="agro-field"><span>Расчётный счёт</span><input value={form.bankAccount} maxLength={20} onChange={(event) => setField("bankAccount", event.target.value)} /></label>
            <label className="agro-field agro-field-wide"><span>Корреспондентский счёт</span><input value={form.corrAccount} maxLength={20} onChange={(event) => setField("corrAccount", event.target.value)} /></label>
          </div>
        </div>
        <div className="agro-dialog-footer"><button type="button" className="agro-btn ghost" onClick={onClose}>Отмена</button><button type="button" className="agro-btn" disabled={saving} onClick={onSubmit}>Сохранить</button></div>
      </section>
    </div>
  );
}

function PageHead({
  title,
  subtitle,
  action,
  onAction,
}: {
  title: string;
  subtitle: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="agro-page-head">
      <div>
        <div className="agro-page-title">{title}</div>
        <div className="agro-page-sub">{subtitle}</div>
      </div>
      {action && (
        <button type="button" className="agro-btn" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function Kpi({
  tone,
  label,
  value,
  delta,
  onClick,
}: {
  tone: string;
  label: string;
  value: string;
  delta: string;
  onClick?: () => void;
}) {
  return (
    <div
      className={`agro-kpi ${tone}`}
      style={onClick ? { cursor: "pointer" } : undefined}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="agro-kpi-label">{label}</div>
      <div className="agro-kpi-val">{value}</div>
      <div className="agro-kpi-delta">{delta}</div>
    </div>
  );
}

function Panel({ title, children, flush = false }: { title?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <div className={`agro-panel ${flush ? "flush" : ""}`}>
      {title && <div className="agro-panel-title">{title}</div>}
      {children}
    </div>
  );
}

function ReferenceView({ title, subtitle, items }: { title: string; subtitle: string; items: string[] }) {
  return (
    <section className="agro-view">
      <PageHead title={title} subtitle={subtitle} />
      <Panel title={title}>
        <div className="agro-muted">Этот раздел оставлен в состоянии прототипа. Рабочая логика подключена только в разделе ТТН.</div>
        <div className="agro-reference-grid">
          {items.map((item) => <div key={item}>{item}</div>)}
        </div>
      </Panel>
    </section>
  );
}

const agroStyles = `
.agro-prototype{
  --grain:#DCEAE8;
  --grain-deep:#9FC3BE;
  --soil:#0B3D3A;
  --soil-soft:#2E5F5A;
  --wheat:#0E7C72;
  --leaf:#127A6E;
  --rust:#9C3B2E;
  --paper:#FBF7EF;
  --ink:#13241F;
  --line:#CFE2DE;
  --display:'Iowan Old Style','Georgia',serif;
  --body:-apple-system,'Segoe UI',Roboto,sans-serif;
  min-height:100vh;
  background:var(--paper);
  color:var(--ink);
  font-family:var(--body);
}
.agro-prototype *{box-sizing:border-box;}
.agro-app{display:flex; min-height:100vh;}
.agro-sidebar{width:230px; flex-shrink:0; background:var(--soil); color:var(--grain); padding:28px 18px; display:flex; flex-direction:column;}
.agro-logo{font-family:var(--display); font-size:22px; font-weight:700; letter-spacing:.5px; color:var(--grain); margin-bottom:4px;}
.agro-logo-sub{font-size:11px; color:var(--grain-deep); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:34px;}
.agro-motto{font-size:10px; color:var(--grain-deep); letter-spacing:1.2px; margin-top:-28px; margin-bottom:22px; font-style:italic;}
.agro-user-badge{display:flex; align-items:center; gap:8px; width:100%; border:0; padding:8px 12px; background:rgba(255,255,255,.08); border-radius:8px; margin-bottom:20px; cursor:pointer; text-align:left;}
.agro-user-badge .av{width:28px; height:28px; background:var(--wheat); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:700; color:#fff;}
.agro-user-badge .un{font-size:12px; color:var(--grain); font-weight:600;}
.agro-user-badge .ur{font-size:10px; color:var(--grain-deep);}
.agro-nav-item{display:flex; align-items:center; gap:10px; width:100%; padding:11px 12px; border-radius:6px; cursor:pointer; font-size:14px; color:var(--grain-deep); margin-bottom:2px; border:0; border-left:3px solid transparent; background:transparent; text-align:left;}
.agro-nav-item:hover{background:rgba(255,255,255,.05); color:var(--grain);}
.agro-nav-item.active{background:rgba(14,124,114,.22); color:#fff; border-left-color:var(--wheat);}
.agro-nav-item.disabled{opacity:.5; cursor:not-allowed;}
.agro-nav-item.disabled:hover{background:transparent; color:var(--grain-deep);}
.agro-nav-icon{width:16px; text-align:center; font-size:14px;}
.agro-sidebar-foot{margin-top:auto; font-size:11px; color:var(--soil-soft); line-height:1.6; padding-top:20px; border-top:1px solid rgba(255,255,255,.08);}
.agro-sidebar-foot button{border:0; background:transparent; padding:0; color:var(--grain-deep); text-decoration:underline; cursor:pointer; font:inherit;}
.agro-main{flex:1; padding:28px 32px; overflow-x:auto; min-width:0;}
.agro-view{animation:agroFade .25s ease;}
@keyframes agroFade{from{opacity:0; transform:translateY(4px)} to{opacity:1; transform:none}}
.agro-page-head{display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:26px; flex-wrap:wrap; gap:10px;}
.agro-page-title{font-family:var(--display); font-size:28px; color:var(--soil);}
.agro-page-sub{font-size:13px; color:var(--soil-soft); margin-top:4px;}
.agro-head-actions{display:flex; gap:10px; flex-wrap:wrap;}
.agro-organization-summary{display:flex; justify-content:space-between; gap:16px; align-items:center;}
.agro-btn{background:var(--wheat); color:#fff; border:0; padding:10px 18px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; font-family:var(--body); white-space:nowrap;}
.agro-btn:hover{background:#0a6358;}
.agro-btn.wide{width:100%; padding:12px;}
.agro-btn.ghost{background:transparent; color:var(--soil); border:1px solid var(--line);}
.agro-btn.small{padding:6px 12px; font-size:12px;}
.agro-kpi-row{display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:22px;}
.agro-kpi{background:#fff; border:1px solid var(--line); border-radius:10px; padding:18px 20px; position:relative; overflow:hidden;}
.agro-kpi:before{content:''; position:absolute; left:0; top:0; bottom:0; width:4px; background:var(--wheat);}
.agro-kpi.leaf:before{background:var(--leaf);}
.agro-kpi.rust:before{background:var(--rust);}
.agro-kpi.soil:before{background:var(--soil-soft);}
.agro-kpi-label{font-size:11px; text-transform:uppercase; letter-spacing:.8px; color:var(--soil-soft);}
.agro-kpi-val{font-family:var(--display); font-size:26px; margin-top:6px; color:var(--ink);}
.agro-kpi-delta{font-size:12px; margin-top:6px; color:var(--leaf);}
.agro-panel{background:#fff; border:1px solid var(--line); border-radius:10px; padding:22px; margin-bottom:20px;}
.agro-panel.flush{padding:0; overflow:hidden;}
.agro-panel-title{font-family:var(--display); font-size:17px; margin-bottom:14px; color:var(--soil);}
.agro-panel-title-row{display:flex; justify-content:space-between; align-items:center;}
.agro-dashboard-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px;}
.agro-dashboard-grid .agro-panel{margin-bottom:20px;}
.agro-document-list{display:grid;}
.agro-document-row{display:grid; grid-template-columns:120px 170px minmax(200px,1fr) 95px; align-items:center; gap:16px; padding:10px 0; border-bottom:1px solid var(--line); font-size:13px;}
.agro-document-row:last-child{border-bottom:0;}
.agro-document-row .agro-tag{text-align:center; display:inline-block; width:100%; box-sizing:border-box;}
.agro-document-row strong{white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--soil);}
.agro-document-row span:not(.agro-tag){color:var(--soil-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.agro-document-row time{color:var(--soil-soft); font-size:12px; white-space:nowrap; text-align:right;}
.agro-document-select{display:flex; flex-direction:column; gap:6px; max-width:520px; margin-bottom:16px; font-size:12px; font-weight:700; color:var(--soil-soft);}
.agro-document-select select{width:100%; border:1px solid var(--line); border-radius:8px; padding:10px 12px; background:#fff; color:var(--ink); font:13px var(--body);}
.agro-deals-list{display:grid; gap:10px;}
.agro-deal-card{display:flex; justify-content:space-between; align-items:center; gap:20px; width:100%; border:1px solid var(--line); border-radius:8px; padding:16px 18px; background:#fff; color:var(--ink); text-align:left; cursor:pointer; font:inherit;}
.agro-deal-card:hover{border-color:var(--wheat); background:#fffdf8;}
.agro-deal-card-main{display:grid; gap:4px; min-width:0;}
.agro-deal-number{font-size:11px; color:var(--soil-soft); text-transform:uppercase; letter-spacing:.5px; font-weight:700;}
.agro-deal-card-main strong{font-size:15px; color:var(--soil);}
.agro-deal-card-main span{font-size:12px; color:var(--soil-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.agro-deal-progress{display:flex; align-items:flex-end; flex-direction:column; gap:4px; flex:0 0 auto; font-size:12px; color:var(--soil-soft);}
.agro-deal-progress b{font-size:13px; color:var(--soil);}
.agro-deal-dialog{width:min(900px,100%);}
.agro-deal-summary{display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin-top:14px;}
.agro-deal-summary .agro-detail-item{border:1px solid var(--line); border-radius:7px; padding:10px;}
.agro-deal-section{margin-top:20px;}
.agro-deal-section h3{font-family:var(--display); color:var(--soil); font-size:17px; margin:0 0 10px;}
.agro-deal-stages{border-top:1px solid var(--line);}
.agro-deal-stage{display:grid; grid-template-columns:28px minmax(0,1fr) auto; gap:10px; align-items:center; padding:11px 0; border-bottom:1px solid var(--line); font-size:13px;}
.agro-deal-stage>span{width:22px; height:22px; display:grid; place-items:center; border-radius:50%; background:var(--line); color:var(--soil-soft); font-size:11px; font-weight:700;}
.agro-deal-stage.complete>span{background:var(--leaf); color:#fff;}
.agro-deal-stage.attention>span{background:var(--rust); color:#fff;}
.agro-deal-stage div{display:grid; gap:2px;}
.agro-deal-stage small{color:var(--soil-soft); font-size:11.5px;}
.agro-deal-stage>strong{font-size:11px; color:var(--soil-soft); text-align:right;}
.agro-deal-stage.complete>strong{color:var(--leaf);}
.agro-deal-stage.attention>strong{color:var(--rust);}
.agro-linked-documents{display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:10px; margin-bottom:12px;}
.agro-linked-documents div{border-bottom:2px solid var(--line); padding:8px 0; display:grid; gap:3px;}
.agro-linked-documents span{font-size:11px; color:var(--soil-soft);}
.agro-linked-documents b{font-family:var(--display); color:var(--soil); font-size:19px;}
.agro-linked-document-list{display:grid; gap:6px; font-size:12px; color:var(--soil-soft);}
.agro-deal-form{width:min(900px,100%);}
.agro-specification-picker{display:grid; gap:7px; margin-top:12px; max-height:250px; overflow-y:auto;}
.agro-specification-option{display:flex; align-items:flex-start; gap:9px; border:1px solid var(--line); border-radius:7px; padding:9px 10px; cursor:pointer; font-size:12px;}
.agro-specification-option input{margin-top:3px; accent-color:var(--wheat);}
.agro-specification-option span{display:grid; gap:2px; color:var(--ink);}
.agro-specification-option small{color:var(--soil-soft);}
.agro-checklist{list-style:none; font-size:13px; padding:0; margin:0;}
.agro-checklist li{display:flex; align-items:center; gap:8px; padding:6px 0;}
.agro-checklist .dot{width:8px; height:8px; border-radius:50%; background:var(--line); flex-shrink:0;}
.agro-checklist .dot.ok{background:var(--leaf);}
.agro-checklist .dot.miss{background:var(--rust);}
.agro-kanban{display:grid; grid-template-columns:repeat(10,minmax(140px,1fr)); gap:10px; align-items:start; padding-bottom:6px;}
.agro-stage{background:var(--grain); border-radius:10px; padding:10px; min-height:90px;}
.agro-stage-head{font-size:10px; text-transform:uppercase; letter-spacing:.4px; color:var(--soil-soft); font-weight:700; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;}
.agro-card{background:#fff; border-radius:8px; padding:10px; margin-bottom:8px; border:1px solid var(--line); font-size:12px;}
.card-crop{font-weight:700; color:var(--soil);}
.card-vol{color:var(--soil-soft); margin-top:2px;}
.card-margin{margin-top:6px; font-size:11px; color:var(--leaf); font-weight:700;}
.card-margin.low{color:var(--rust);}
.agro-tabs{display:flex; gap:4px; margin-bottom:18px; border-bottom:1px solid var(--line);}
.agro-tabs button{padding:9px 16px; font-size:13px; font-family:var(--body); color:var(--soil-soft); border:0; border-bottom:2px solid transparent; background:transparent; cursor:pointer;}
.agro-tabs .active{color:var(--soil); border-bottom-color:var(--wheat); font-weight:600;}
.agro-table{width:100%; border-collapse:collapse; font-size:13px;}
.agro-table th{text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--soil-soft); padding:8px 10px; border-bottom:2px solid var(--line);}
.agro-table td{padding:10px; border-bottom:1px solid var(--line);}
.agro-table tr:hover td{background:#FAF5E9;}
.agro-clickable-row{cursor:pointer;}
.agro-table-secondary{color:var(--soil-soft); font-size:11px; margin-top:3px;}
.agro-empty-row{text-align:center; color:var(--soil-soft); padding:28px !important;}
.agro-status-ok{color:var(--leaf); font-weight:600;}
.agro-status-attention{color:var(--rust); font-weight:600;}
.agro-status-badge{display:inline-block; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:600;}
.agro-status-badge.normal{background:#EAF1E5; color:var(--leaf);}
.agro-status-badge.missing_scans{background:#FDF3D7; color:#A86B00;}
.agro-status-badge.blacklisted{background:#FBE4E0; color:var(--rust);}
.agro-status-badge.debtor{background:#FDEBD7; color:#B4560A;}
.agro-tag{display:inline-block; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:600; background:#EAF1E5; color:var(--leaf);}
.agro-vat-badge{display:inline-block; padding:2px 10px; border-radius:20px; font-size:11px; font-weight:700; text-align:center; min-width:38px;}
.agro-vat-badge.vat{background:#EFF6FF; color:#1D4ED8; border:1px solid #BFDBFE;}
.agro-vat-badge.no-vat{background:#F3F4F6; color:#4B5563; border:1px solid #E5E7EB;}
.agro-filter-group{display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:12px; margin-bottom:14px;}
.agro-filter-group .agro-tabs{margin-bottom:0;}
.agro-tabs-vat{border-bottom:0;}
.agro-tabs-vat button{border-radius:6px; padding:6px 12px; font-size:12px; border:1px solid var(--line); background:#fff;}
.agro-tabs-vat .active{background:var(--soil); color:#fff; border-color:var(--soil);}
.agro-dialog-badges{display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:4px;}
.agro-counterparty-statutory-wrap{margin-top:16px;}
.agro-muted{color:var(--soil-soft); font-size:13px; padding:4px 0;}
.agro-reference-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; margin-top:16px;}
.agro-reference-grid div{background:var(--paper); border:1px solid var(--line); border-radius:8px; padding:12px; font-size:13px;}
.agro-live-module{background:#fff; border:1px solid var(--line); border-radius:10px; overflow:hidden;}
.agro-live-module > div{max-width:none;}
.agro-dialog-backdrop{position:fixed; inset:0; z-index:250; background:rgba(11,61,58,.42); display:flex; justify-content:center; align-items:center; padding:24px;}
.agro-dialog{width:min(980px,100%); max-height:calc(100vh - 48px); overflow-y:auto; background:#fff; border:1px solid var(--line); border-radius:10px; box-shadow:0 20px 60px rgba(11,61,58,.28); padding:24px;}
.agro-counterparty-form{width:min(860px,100%);}
.agro-dialog-head{display:flex; justify-content:space-between; align-items:flex-start; gap:20px; border-bottom:1px solid var(--line); padding-bottom:16px;}
.agro-dialog-head h2{font-family:var(--display); font-size:24px; color:var(--soil); margin:2px 0 8px;}
.agro-dialog-kicker{font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.7px; color:var(--soil-soft);}
.agro-icon-button{border:1px solid var(--line); background:#fff; color:var(--soil); width:32px; height:32px; line-height:28px; font-size:22px; border-radius:6px; cursor:pointer; flex:0 0 auto;}
.agro-card-actions{display:flex; justify-content:flex-end; padding:14px 0 0;}
.agro-card-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; margin-top:14px;}
.agro-detail-group{border:1px solid var(--line); border-radius:8px; padding:14px;}
.agro-detail-group h3,.agro-form-section h3{font-family:var(--display); color:var(--soil); font-size:16px; margin:0 0 10px;}
.agro-detail-item{padding:7px 0; border-bottom:1px solid #e8f0ed; display:flex; flex-direction:column; gap:2px; font-size:12px;}
.agro-detail-item:last-child{border-bottom:0;}
.agro-detail-item span{color:var(--soil-soft);}
.agro-detail-item b{font-weight:600; overflow-wrap:anywhere;}
.agro-counterparty-scans{margin-top:16px;}
.agro-counterparty-scans > h3{font-family:var(--display); font-size:17px; color:var(--soil); margin:0 0 10px;}
.agro-linked-contract{border:1px solid var(--line); border-radius:8px; padding:12px; margin-bottom:12px; display:grid; gap:10px;}
.agro-linked-contract-title{font-size:13px; font-weight:700; color:var(--soil);}
.agro-form-section{border-bottom:1px solid var(--line); padding:18px 0;}
.agro-form-section:last-of-type{border-bottom:0;}
.agro-form-grid{display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px;}
.agro-form-grid-four{grid-template-columns:repeat(4,minmax(0,1fr));}
.agro-field{display:flex; flex-direction:column; gap:5px; min-width:0; font-size:12px; font-weight:600; color:var(--soil-soft);}
.agro-field-wide{grid-column:span 2;}
.agro-field input,.agro-field select,.agro-field textarea{width:100%; border:1px solid var(--line); border-radius:6px; padding:9px 10px; background:#fff; color:var(--ink); font:13px var(--body);}
.agro-field textarea{resize:vertical;}
.agro-dialog-footer{display:flex; justify-content:flex-end; gap:10px; padding-top:20px;}
.agro-btn:disabled{opacity:.6; cursor:not-allowed;}
@media (max-width:1100px){
  .agro-kpi-row{grid-template-columns:repeat(2,1fr);}
  .agro-card-grid{grid-template-columns:1fr;}
  .agro-deal-summary{grid-template-columns:repeat(2,minmax(0,1fr));}
}
@media (max-width:760px){
  .agro-app{display:block;}
  .agro-sidebar{width:100%; min-height:auto;}
  .agro-main{padding:20px;}
  .agro-kpi-row,.agro-reference-grid,.agro-dashboard-grid,.agro-deal-summary,.agro-linked-documents{grid-template-columns:1fr;}
  .agro-deal-card{align-items:flex-start; flex-direction:column;}
  .agro-deal-progress{align-items:flex-start;}
  .agro-document-row{grid-template-columns:auto 1fr;}
  .agro-document-row span:not(.agro-tag){grid-column:2;}
  .agro-document-row time{grid-column:2;}
  .agro-tabs{overflow-x:auto;}
  .agro-tabs button{white-space:nowrap;}
  .agro-dialog-backdrop{align-items:flex-end; padding:0;}
  .agro-dialog{max-height:92vh; border-radius:10px 10px 0 0; padding:18px;}
  .agro-form-grid,.agro-form-grid-four{grid-template-columns:1fr;}
  .agro-field-wide{grid-column:span 1;}
}
`;
