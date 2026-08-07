import { useMemo, useState } from "react";
import { ScanAttachments } from "@/components/ScanAttachments";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import Waybills from "./Waybills";

type ViewKey =
  | "dashboard"
  | "deals"
  | "contractors"
  | "statutory"
  | "logistics"
  | "receivables"
  | "bank"
  | "ai-agent"
  | "ttn";

interface AgroTradePrototypeProps {
  initialView?: ViewKey;
}

type CounterpartyRole = "seller" | "buyer" | "carrier";
type CounterpartyTab = "all" | CounterpartyRole;
type CounterpartyFormState = {
  name: string;
  shortName: string;
  type: "legal" | "individual" | "sole_trader";
  businessRole: CounterpartyRole;
  region: string;
  profile: string;
  inn: string;
  ogrn: string;
  kpp: string;
  okpo: string;
  legalAddress: string;
  postalAddress: string;
  actualAddress: string;
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
  region: "",
  profile: "",
  inn: "",
  ogrn: "",
  kpp: "",
  okpo: "",
  legalAddress: "",
  postalAddress: "",
  actualAddress: "",
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
  return {
    ...emptyCounterpartyForm,
    ...Object.fromEntries(Object.entries(counterparty).map(([key, value]) => [key, value ?? ""])),
  } as CounterpartyFormState;
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
  { key: "statutory", icon: "⚑", label: "Уставные документы" },
  { key: "logistics", icon: "▤", label: "Логистика", disabled: true },
  { key: "receivables", icon: "฿", label: "Дебиторка", disabled: true },
  { key: "bank", icon: "▣", label: "Банк", disabled: true },
  { key: "ai-agent", icon: "✦", label: "ИИ-агент / Почта", disabled: true },
  { key: "ttn", icon: "▥", label: "ТТН" },
];

export default function AgroTradePrototype({ initialView = "dashboard" }: AgroTradePrototypeProps) {
  const [loggedIn, setLoggedIn] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"director" | "manager">("director");
  const [activeView, setActiveView] = useState<ViewKey>(initialView);
  const [selectedStatutoryCounterpartyId, setSelectedStatutoryCounterpartyId] = useState("");
  const [counterpartyTab, setCounterpartyTab] = useState<CounterpartyTab>("all");
  const [selectedCounterpartyId, setSelectedCounterpartyId] = useState<number | null>(null);
  const [counterpartyFormOpen, setCounterpartyFormOpen] = useState(false);
  const [organizationFormOpen, setOrganizationFormOpen] = useState(false);
  const [editingCounterpartyId, setEditingCounterpartyId] = useState<number | null>(null);
  const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
  const [dealFormOpen, setDealFormOpen] = useState(false);
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

  const createCounterparty = trpc.counterparties.create.useMutation({
    onSuccess: (counterparty) => {
      utils.counterparties.list.invalidate();
      utils.dashboard.stats.invalidate();
      setCounterpartyFormOpen(false);
      setCounterpartyForm(emptyCounterpartyForm);
      if (counterparty?.id) setSelectedCounterpartyId(counterparty.id);
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
  }

  const filteredCounterparties = counterparties.filter((counterparty) => {
    if (counterpartyTab === "all") return true;
    return counterparty.businessRole === counterpartyTab;
  });
  const selectedCounterparty = counterparties.find((counterparty) => counterparty.id === selectedCounterpartyId) ?? null;
  const selectedStatutoryCounterparty = counterparties.find(
    (counterparty) => String(counterparty.id) === selectedStatutoryCounterpartyId,
  ) ?? null;
  const selectedCounterpartyContracts = selectedCounterparty
    ? contracts.filter((item) => item.contract.counterpartyId === selectedCounterparty.id)
    : [];
  const dealViewModels = useMemo(() => dealRecords.map((deal) => {
    const linkedSpecifications = specifications.filter((item) => item.specification.dealId === deal.id);
    const linkedContractIds = new Set(linkedSpecifications.map((item) => item.specification.contractId));
    const linkedContracts = contracts.filter((item) => linkedContractIds.has(item.contract.id));
    const linkedWaybills = waybills.filter((waybill) => linkedSpecifications.some(
      (specification) => specification.specification.id === waybill.specificationId,
    ));
    const contractKinds = new Set(linkedContracts.map((item) => item.contract.contractKind));
    const specificationKinds = new Set(linkedSpecifications.map((item) => (
      contracts.find((contract) => contract.contract.id === item.specification.contractId)?.contract.contractKind
    )));
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
      { title: "Условия сделки", detail: `${deal.cargoName} · ${formatTons(decimal(deal.plannedVolume))}`, state: "complete" as const },
      { title: "Договор закупки", detail: contractKinds.has("purchase") ? "Договор привязан" : "Нужен договор с продавцом", state: contractKinds.has("purchase") ? "complete" as const : "waiting" as const },
      { title: "Договор реализации", detail: contractKinds.has("sale") ? "Договор привязан" : "Нужен договор с покупателем", state: contractKinds.has("sale") ? "complete" as const : "waiting" as const },
      {
        title: "Спецификации",
        detail: specificationKinds.has("purchase") && specificationKinds.has("sale")
          ? `${linkedSpecifications.length} привязано`
          : "Нужны спецификации закупки и реализации",
        state: specificationKinds.has("purchase") && specificationKinds.has("sale") ? "complete" as const : "waiting" as const,
      },
      {
        title: "Перевозчик",
        detail: deal.carrierId ? (contractKinds.has("carriage") ? "Перевозчик и договор назначены" : "Перевозчик назначен") : "Перевозчик не назначен",
        state: deal.carrierId ? "complete" as const : "waiting" as const,
      },
      {
        title: "Отгрузка",
        detail: linkedWaybills.length ? `ТТН: ${linkedWaybills.length}, в пути: ${linkedWaybills.filter((waybill) => waybill.status === "in_transit").length}` : "ТТН ещё не сформированы",
        state: linkedWaybills.length ? "complete" as const : "waiting" as const,
      },
      {
        title: "Закрытие и вес",
        detail: weightProblem ? "Есть расхождения или не внесён факт" : allWaybillsClosed ? "Все ТТН закрыты" : "Ожидается закрытие ТТН",
        state: weightProblem ? "attention" as const : allWaybillsClosed ? "complete" as const : "waiting" as const,
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
    setDealForm(emptyDealForm);
    setDealFormOpen(true);
  }

  function openEditDeal(dealId: number) {
    const model = dealViewModels.find((item) => item.deal.id === dealId);
    if (!model) return;
    const deal = model.deal;
    setEditingDealId(deal.id);
    setDealForm({
      number: deal.number,
      sellerId: String(deal.sellerId),
      buyerId: String(deal.buyerId),
      carrierId: deal.carrierId ? String(deal.carrierId) : "",
      cargoName: deal.cargoName,
      cargoGrade: deal.cargoGrade ?? "",
      plannedVolume: deal.plannedVolume ?? "",
      purchasePrice: deal.purchasePrice ?? "",
      salePrice: deal.salePrice ?? "",
      currency: deal.currency ?? "RUB",
      startDate: deal.startDate ? new Date(deal.startDate).toISOString().split("T")[0] : "",
      endDate: deal.endDate ? new Date(deal.endDate).toISOString().split("T")[0] : "",
      status: deal.status,
      notes: deal.notes ?? "",
      specificationIds: model.linkedSpecifications.map((item) => item.specification.id),
    });
    setSelectedDealId(null);
    setDealFormOpen(true);
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

      {!loggedIn && (
        <div className="agro-login-screen">
          <div className="agro-login-box">
            <div className="agro-login-logo">
              Алмаз<span>Агро</span>
            </div>
            <div className="agro-login-sub">Trading OS</div>
            <div className="agro-form-row">
              <label>Пользователь</label>
              <select onChange={(event) => setSelectedRole(event.target.value === "director" ? "director" : "manager")}>
                <option value="director">Алмаз Агро — директор (Полный доступ)</option>
                <option value="manager">Иванов А.С. — менеджер</option>
                <option value="manager">Петрова М.В. — менеджер</option>
              </select>
            </div>
            <div className="agro-form-row">
              <label>Роль</label>
              <div className="agro-role-cards">
                <button
                  type="button"
                  className={`agro-role-card ${selectedRole === "director" ? "selected" : ""}`}
                  onClick={() => setSelectedRole("director")}
                >
                  <div className="ri">♛</div>
                  <div className="rn">Директор</div>
                  <div className="rd">Полный доступ</div>
                </button>
                <button
                  type="button"
                  className={`agro-role-card ${selectedRole === "manager" ? "selected" : ""}`}
                  onClick={() => setSelectedRole("manager")}
                >
                  <div className="ri">●</div>
                  <div className="rn">Менеджер</div>
                  <div className="rd">Только свои сделки</div>
                </button>
              </div>
            </div>
            <button type="button" className="agro-btn wide" onClick={() => setLoggedIn(true)}>
              Войти в систему
            </button>
          </div>
        </div>
      )}

      <div className="agro-app">
        <aside className="agro-sidebar">
          <div className="agro-logo">
            Алмаз<span>Агро</span>
          </div>
          <div className="agro-logo-sub">Trading OS · прототип</div>
          <div className="agro-motto">твёрдые решения</div>

          <button type="button" className="agro-user-badge" onClick={() => setLoggedIn(false)}>
            <div className="av">{selectedRole === "director" ? "Д" : "М"}</div>
            <div>
              <div className="un">{selectedRole === "director" ? "Директор" : "Менеджер"}</div>
              <div className="ur">{selectedRole === "director" ? "Полный доступ" : "Только свои сделки"}</div>
            </div>
          </button>

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

          <div className="agro-sidebar-foot">
            Все изменения сохраняются автоматически.
            <br />
            <button type="button">Сбросить к демо-данным</button>
          </div>
        </aside>

        <main className="agro-main">
          {activeView === "dashboard" && (
            <section className="agro-view">
              <PageHead title="Дашборд" subtitle="Оперативная сводка по внесённым договорам, спецификациям и ТТН" />
              <div className="agro-kpi-row">
                <Kpi tone="wheat" label="Активные договоры" value={String(dashboardData.activeContracts)} delta={`Всего: ${contracts.length}`} />
                <Kpi tone="leaf" label="Спецификации в работе" value={String(dashboardData.openSpecifications)} delta={`Остаток: ${formatTons(dashboardData.remainingVolume)}`} />
                <Kpi tone="soil" label="ТТН в пути" value={String(dashboardData.inTransit)} delta={`Плановый вес: ${formatTons(dashboardData.plannedInTransit)}`} />
                <Kpi tone="rust" label="Контроль веса" value={String(dashboardData.weightIssues)} delta={`Расхождение: ${formatTons(dashboardData.documentedWeightDifferences)}`} />
              </div>
              <div className="agro-dashboard-grid">
                <Panel title="Документы в работе">
                  <ul className="agro-checklist">
                    <li><span className="dot ok" /> Активных договоров: <b>{dashboardData.activeContracts}</b></li>
                    <li><span className="dot ok" /> Открытых спецификаций: <b>{dashboardData.openSpecifications}</b></li>
                    <li><span className={dashboardData.inTransit ? "dot miss" : "dot ok"} /> ТТН в пути: <b>{dashboardData.inTransit}</b></li>
                    <li><span className={dashboardData.weightIssues ? "dot miss" : "dot ok"} /> Закрытых ТТН с замечаниями по весу: <b>{dashboardData.weightIssues}</b></li>
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
                  <div className="agro-page-sub">Карточка объединяет условия, договоры, спецификации, ТТН и контроль фактического веса</div>
                </div>
                <button type="button" className="agro-btn" onClick={openCreateDeal}>＋ Новая сделка</button>
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
              <div className="agro-tabs">
                {([
                  ["all", "Все"],
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
              <Panel flush>
                <table className="agro-table">
                  <thead><tr><th>Контрагент</th><th>Тип</th><th>Регион</th><th>Профиль</th><th>Договоров</th><th>Статус</th></tr></thead>
                  <tbody>
                    {counterpartiesLoading && <tr><td colSpan={6} className="agro-empty-row">Загрузка контрагентов...</td></tr>}
                    {!counterpartiesLoading && !filteredCounterparties.length && (
                      <tr><td colSpan={6} className="agro-empty-row">В этом разделе пока нет контрагентов. Создайте первую карточку.</td></tr>
                    )}
                    {filteredCounterparties.map((counterparty) => {
                      const contractsCount = contracts.filter((item) => item.contract.counterpartyId === counterparty.id).length;
                      const isComplete = Boolean(counterparty.inn && counterparty.bankAccount && counterparty.representativeName);
                      return (
                        <tr key={counterparty.id} className="agro-clickable-row" onClick={() => setSelectedCounterpartyId(counterparty.id)}>
                          <td>
                            <strong>{counterparty.shortName || counterparty.name}</strong>
                            {counterparty.shortName && <div className="agro-table-secondary">{counterparty.name}</div>}
                          </td>
                          <td><span className="agro-tag">{roleLabels[counterparty.businessRole as CounterpartyRole] ?? "Роль не назначена"}</span></td>
                          <td>{counterparty.region || "—"}</td>
                          <td>{counterparty.profile || "—"}</td>
                          <td>{contractsCount}</td>
                          <td><span className={isComplete ? "agro-status-ok" : "agro-status-attention"}>{isComplete ? "В норме" : "Нужны реквизиты"}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Panel>
            </section>
          )}

          {activeView === "statutory" && (
            <section className="agro-view">
              <PageHead title="Уставные документы" subtitle="Сканы и документы контрагентов" />
              <Panel title="Документы контрагентов">
                <label className="agro-document-select">
                  <span>Контрагент</span>
                  <select value={selectedStatutoryCounterpartyId} onChange={(event) => setSelectedStatutoryCounterpartyId(event.target.value)}>
                    <option value="">Выберите контрагента</option>
                    {counterparties.map((counterparty) => (
                      <option key={counterparty.id} value={counterparty.id}>{counterparty.shortName || counterparty.name}</option>
                    ))}
                  </select>
                </label>
                {selectedStatutoryCounterparty ? (
                  <ScanAttachments
                    entityType="counterparty"
                    entityId={selectedStatutoryCounterparty.id}
                    documentKind="statutory_document"
                    title={`Уставные документы: ${selectedStatutoryCounterparty.shortName || selectedStatutoryCounterparty.name}`}
                  />
                ) : <div className="agro-muted">Выберите контрагента, чтобы открыть его архив документов.</div>}
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
        <div className="agro-dialog-backdrop" role="presentation" onMouseDown={() => setSelectedCounterpartyId(null)}>
          <section className="agro-dialog agro-counterparty-card" role="dialog" aria-modal="true" aria-label="Карточка контрагента" onMouseDown={(event) => event.stopPropagation()}>
            <div className="agro-dialog-head">
              <div>
                <div className="agro-dialog-kicker">Карточка контрагента</div>
                <h2>{selectedCounterparty.name}</h2>
                <span className="agro-tag">{roleLabels[selectedCounterparty.businessRole as CounterpartyRole] ?? "Роль не назначена"}</span>
              </div>
              <button type="button" className="agro-icon-button" onClick={() => setSelectedCounterpartyId(null)} aria-label="Закрыть карточку" title="Закрыть">×</button>
            </div>
            <div className="agro-card-actions">
              <button type="button" className="agro-btn ghost small" onClick={openEditCounterparty}>Редактировать</button>
            </div>
            <div className="agro-card-grid">
              <div className="agro-detail-group">
                <h3>Основное</h3>
                <DetailItem label="Краткое наименование" value={selectedCounterparty.shortName} />
                <DetailItem label="Регион" value={selectedCounterparty.region} />
                <DetailItem label="Профиль" value={selectedCounterparty.profile} />
                <DetailItem label="ИНН" value={selectedCounterparty.inn} />
                <DetailItem label="КПП" value={selectedCounterparty.kpp} />
                <DetailItem label="ОГРН" value={selectedCounterparty.ogrn} />
              </div>
              <div className="agro-detail-group">
                <h3>Представитель</h3>
                <DetailItem label="ФИО" value={selectedCounterparty.representativeName} />
                <DetailItem label="Должность" value={selectedCounterparty.representativePosition} />
                <DetailItem label="Основание полномочий" value={selectedCounterparty.authorityBasis} />
                <DetailItem label="Телефон" value={selectedCounterparty.phone} />
                <DetailItem label="Email" value={selectedCounterparty.email} />
              </div>
              <div className="agro-detail-group">
                <h3>Адреса и банк</h3>
                <DetailItem label="Юридический адрес" value={selectedCounterparty.legalAddress} />
                <DetailItem label="Почтовый адрес" value={selectedCounterparty.postalAddress} />
                <DetailItem label="Фактический адрес" value={selectedCounterparty.actualAddress} />
                <DetailItem label="Банк" value={selectedCounterparty.bankName} />
                <DetailItem label="БИК" value={selectedCounterparty.bankBik} />
                <DetailItem label="Расчётный счёт" value={selectedCounterparty.bankAccount} />
                <DetailItem label="Корр. счёт" value={selectedCounterparty.corrAccount} />
              </div>
            </div>
            <div className="agro-counterparty-scans">
              <h3>Договоры и сканы</h3>
              {!selectedCounterpartyContracts.length && <div className="agro-muted">У контрагента пока нет договоров.</div>}
              {selectedCounterpartyContracts.map((item) => {
                const contractSpecifications = specifications.filter((specification) => specification.specification.contractId === item.contract.id);
                return (
                  <div key={item.contract.id} className="agro-linked-contract">
                    <div className="agro-linked-contract-title">Договор № {item.contract.number}</div>
                    <ScanAttachments entityType="contract" entityId={item.contract.id} documentKind="contract_scan" title="Скан договора" compact />
                    {contractSpecifications.map((specification) => (
                      <ScanAttachments
                        key={specification.specification.id}
                        entityType="contract"
                        entityId={item.contract.id}
                        documentKind="specification_scan"
                        specificationId={specification.specification.id}
                        title={`Скан спецификации № ${specification.specification.number}`}
                        compact
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {selectedDeal && !dealFormOpen && (
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
              <button type="button" className="agro-btn ghost small" onClick={() => openEditDeal(selectedDeal.deal.id)}>Редактировать</button>
            </div>
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
              <h3>Связанные документы</h3>
              <div className="agro-linked-documents">
                <div><span>Договоров</span><b>{selectedDeal.linkedContracts.length}</b></div>
                <div><span>Спецификаций</span><b>{selectedDeal.linkedSpecifications.length}</b></div>
                <div><span>ТТН</span><b>{selectedDeal.linkedWaybills.length}</b></div>
                <div><span>Закрыто ТТН</span><b>{selectedDeal.linkedWaybills.filter((waybill) => waybill.status === "delivered").length}</b></div>
              </div>
              {!selectedDeal.linkedSpecifications.length ? <div className="agro-muted">Привяжите спецификации в режиме редактирования: по ним в сделку попадут договоры и ТТН.</div> : (
                <div className="agro-linked-document-list">
                  {selectedDeal.linkedSpecifications.map((item) => <div key={item.specification.id}>Спецификация № {item.specification.number} · {item.specification.cargoName || "Груз не указан"}</div>)}
                  {selectedDeal.linkedWaybills.map((waybill) => <div key={waybill.id}>ТТН № {waybill.number} · {waybill.status === "delivered" ? "закрыта" : waybill.status === "in_transit" ? "в пути" : "черновик"}</div>)}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

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
            {!specifications.length ? <div className="agro-muted">Сначала создайте спецификации в соответствующем разделе.</div> : specifications.map((item) => {
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

function PageHead({ title, subtitle, action }: { title: string; subtitle: string; action?: string }) {
  return (
    <div className="agro-page-head">
      <div>
        <div className="agro-page-title">{title}</div>
        <div className="agro-page-sub">{subtitle}</div>
      </div>
      {action && <button type="button" className="agro-btn">{action}</button>}
    </div>
  );
}

function Kpi({ tone, label, value, delta }: { tone: string; label: string; value: string; delta: string }) {
  return (
    <div className={`agro-kpi ${tone}`}>
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
.agro-login-screen{position:fixed; inset:0; z-index:200; display:flex; align-items:center; justify-content:center; background:var(--soil);}
.agro-login-box{width:380px; border-radius:16px; background:#fff; padding:44px 48px; text-align:center;}
.agro-login-logo{font-family:var(--display); font-size:32px; color:var(--soil); margin-bottom:4px;}
.agro-login-logo span,.agro-logo span{color:var(--wheat);}
.agro-login-sub{font-size:12px; color:var(--soil-soft); text-transform:uppercase; letter-spacing:1.5px; margin-bottom:32px;}
.agro-form-row{margin-bottom:14px; text-align:left;}
.agro-form-row label{display:block; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:var(--soil-soft); margin-bottom:5px;}
.agro-form-row select{width:100%; padding:9px 10px; border:1px solid var(--line); border-radius:6px; font-size:13px; background:#fff;}
.agro-role-cards{display:flex; gap:10px; margin-bottom:24px;}
.agro-role-card{flex:1; border:2px solid var(--line); border-radius:10px; padding:14px 10px; cursor:pointer; text-align:center; background:#fff;}
.agro-role-card.selected{border-color:var(--wheat); background:rgba(14,124,114,.07);}
.agro-role-card .ri{font-size:22px; margin-bottom:6px;}
.agro-role-card .rn{font-weight:700; color:var(--soil);}
.agro-role-card .rd{font-size:11px; color:var(--soil-soft); margin-top:3px;}
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
.agro-document-row{display:grid; grid-template-columns:auto minmax(105px,.8fr) minmax(160px,2fr) auto; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--line); font-size:13px;}
.agro-document-row:last-child{border-bottom:0;}
.agro-document-row span:not(.agro-tag){color:var(--soil-soft); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
.agro-document-row time{color:var(--soil-soft); font-size:12px; white-space:nowrap;}
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
.agro-tag{display:inline-block; padding:2px 9px; border-radius:20px; font-size:11px; font-weight:600; background:#EAF1E5; color:var(--leaf);}
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
.agro-card-grid{display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin-top:14px;}
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
