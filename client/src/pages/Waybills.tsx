import { trpc } from "@/lib/trpc";
import { WAYBILL_STATUSES, formatDate, formatWeight } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Download,
  Eye,
  FileSpreadsheet,
  Link2,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  Truck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

type WaybillStatus = "draft" | "in_transit" | "delivered" | "cancelled";
type PartyRole = "supplier" | "buyer" | "carrier" | "vehicleOwner" | "payer";
type CounterpartyType = "legal" | "individual" | "sole_trader";

interface FormState {
  specificationId: string;
  contractId: string;
  supplierId: string;
  supplierName: string;
  loadingAddress: string;
  buyerId: string;
  buyerName: string;
  unloadingAddress: string;
  carrierId: string;
  carrierName: string;
  vehicleOwnerId: string;
  vehicleOwnerName: string;
  payerId: string;
  payerName: string;
  driverName: string;
  vehicleMake: string;
  tractorNumber: string;
  trailerNumber: string;
  tripSheetNumber: string;
  routeNumber: string;
  garageNumber: string;
  grossWeight: string;
  tareWeight: string;
  netWeight: string;
  cargoName: string;
  cargoGrade: string;
  impurityPercent: string;
  moisturePercent: string;
  packageType: string;
  quantity: string;
  cargoClass: string;
  pricePerUnit: string;
  currency: string;
  status: WaybillStatus;
  waybillDate: string;
  declarationInfo: string;
  notes: string;
}

interface QuickPartyForm {
  name: string;
  shortName: string;
  type: CounterpartyType;
  inn: string;
  okpo: string;
  legalAddress: string;
  actualAddress: string;
  phone: string;
}

const partyLabels: Record<PartyRole, string> = {
  supplier: "Поставщик / грузоотправитель",
  buyer: "Грузополучатель",
  carrier: "Перевозчик / составитель ТТН",
  vehicleOwner: "Владелец автотранспорта",
  payer: "Заказчик / плательщик",
};

const quickPartyEmpty: QuickPartyForm = {
  name: "",
  shortName: "",
  type: "legal",
  inn: "",
  okpo: "",
  legalAddress: "",
  actualAddress: "",
  phone: "",
};

function createEmptyForm(): FormState {
  return {
    specificationId: "",
    contractId: "",
    supplierId: "",
    supplierName: "",
    loadingAddress: "",
    buyerId: "",
    buyerName: "",
    unloadingAddress: "",
    carrierId: "",
    carrierName: "",
    vehicleOwnerId: "",
    vehicleOwnerName: "",
    payerId: "",
    payerName: "",
    driverName: "",
    vehicleMake: "",
    tractorNumber: "",
    trailerNumber: "",
    tripSheetNumber: "",
    routeNumber: "",
    garageNumber: "",
    grossWeight: "",
    tareWeight: "",
    netWeight: "",
    cargoName: "",
    cargoGrade: "",
    impurityPercent: "",
    moisturePercent: "",
    packageType: "н/у",
    quantity: "",
    cargoClass: "",
    pricePerUnit: "",
    currency: "RUB",
    status: "draft",
    waybillDate: new Date().toISOString().split("T")[0],
    declarationInfo: "",
    notes: "",
  };
}

interface PartySelectorProps {
  label: string;
  value: string;
  manualName: string;
  counterparties: Array<{ id: number; name: string; shortName: string | null }> | undefined;
  onSelect: (value: string) => void;
  onManualName: (value: string) => void;
  onAdd: () => void;
}

function PartySelector({
  label,
  value,
  manualName,
  counterparties,
  onSelect,
  onManualName,
  onAdd,
}: PartySelectorProps) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <button type="button" onClick={onAdd} className="text-xs text-primary hover:underline">
          + добавить нового
        </button>
      </div>
      <Select value={value || "manual"} onValueChange={onSelect}>
        <SelectTrigger className="mt-1">
          <SelectValue placeholder="Выберите из базы" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="manual">— Ввести вручную —</SelectItem>
          {counterparties?.map((party) => (
            <SelectItem key={party.id} value={String(party.id)}>
              {party.shortName ?? party.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!value && (
        <Input
          value={manualName}
          onChange={(event) => onManualName(event.target.value)}
          placeholder={label}
          className="mt-2"
        />
      )}
    </div>
  );
}

function DetailParty({
  label,
  party,
  fallback,
}: {
  label: string;
  party?: { id: number; name: string; shortName: string | null; inn: string | null } | null;
  fallback?: string | null;
}) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      {party ? (
        <Link href={`/counterparties/${party.id}`} className="mt-1 block text-sm font-medium text-primary hover:underline">
          {party.shortName ?? party.name}
        </Link>
      ) : (
        <p className="mt-1 text-sm font-medium">{fallback || "Не указан"}</p>
      )}
      {party?.inn && <p className="text-xs text-muted-foreground">ИНН {party.inn}</p>}
    </div>
  );
}

export default function Waybills() {
  const searchStr = useSearch();
  const urlParams = new URLSearchParams(searchStr);
  const preselectedCounterpartyId = urlParams.get("counterpartyId");
  const shouldAutoOpenCreate = urlParams.get("create") === "1";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [hasAutoOpenedCreate, setHasAutoOpenedCreate] = useState(false);
  const [form, setForm] = useState<FormState>(createEmptyForm);
  const [quickPartyOpen, setQuickPartyOpen] = useState(false);
  const [quickPartyRole, setQuickPartyRole] = useState<PartyRole>("supplier");
  const [quickParty, setQuickParty] = useState<QuickPartyForm>(quickPartyEmpty);
  const utils = trpc.useUtils();

  const { data: list, isLoading } = trpc.waybills.list.useQuery({
    search: search || undefined,
    status: statusFilter || undefined,
    counterpartyId: preselectedCounterpartyId ? parseInt(preselectedCounterpartyId) : undefined,
  });
  const { data: specifications } = trpc.specifications.list.useQuery({});
  const { data: contracts } = trpc.contracts.list.useQuery({});
  const { data: counterparties } = trpc.counterparties.list.useQuery({});
  const { data: details } = trpc.waybills.getDetails.useQuery(
    { id: detailsId ?? 0 },
    { enabled: detailsId !== null }
  );
  const { data: carrierDefaults } = trpc.waybills.lastCarrierData.useQuery(
    { carrierId: Number(form.carrierId) || 0 },
    { enabled: dialogOpen && Boolean(form.carrierId) }
  );

  const createMutation = trpc.waybills.create.useMutation({
    onSuccess: () => {
      utils.waybills.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setForm(createEmptyForm());
      toast.success("Накладная создана");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateMutation = trpc.waybills.update.useMutation({
    onSuccess: () => {
      utils.waybills.list.invalidate();
      setDialogOpen(false);
      setEditId(null);
      toast.success("Накладная обновлена");
    },
    onError: (error) => toast.error(error.message),
  });

  const updateStatusMutation = trpc.waybills.updateStatus.useMutation({
    onSuccess: () => {
      utils.waybills.list.invalidate();
      toast.success("Статус обновлён");
    },
    onError: (error) => toast.error(error.message),
  });

  const deleteMutation = trpc.waybills.delete.useMutation({
    onSuccess: () => {
      utils.waybills.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Накладная удалена");
    },
    onError: (error) => toast.error(error.message),
  });

  const createPartyMutation = trpc.counterparties.create.useMutation({
    onSuccess: (party) => {
      if (!party) return;
      utils.counterparties.list.invalidate();
      applyCounterparty(quickPartyRole, String(party.id), party);
      setQuickPartyOpen(false);
      setQuickParty(quickPartyEmpty);
      toast.success("Контрагент добавлен и выбран");
    },
    onError: (error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!carrierDefaults) return;
    setForm((previous) => ({
      ...previous,
      driverName: previous.driverName || carrierDefaults.driverName || "",
      vehicleMake: previous.vehicleMake || carrierDefaults.vehicleMake || "",
      tractorNumber: previous.tractorNumber || carrierDefaults.tractorNumber || "",
      trailerNumber: previous.trailerNumber || carrierDefaults.trailerNumber || "",
      vehicleOwnerId: previous.vehicleOwnerId || (carrierDefaults.vehicleOwnerId ? String(carrierDefaults.vehicleOwnerId) : ""),
      vehicleOwnerName: previous.vehicleOwnerName || carrierDefaults.vehicleOwnerName || "",
    }));
  }, [carrierDefaults]);

  useEffect(() => {
    if (!shouldAutoOpenCreate) {
      setHasAutoOpenedCreate(false);
      return;
    }
    if (hasAutoOpenedCreate) return;
    openCreate();
    setHasAutoOpenedCreate(true);
  }, [hasAutoOpenedCreate, shouldAutoOpenCreate]);

  function openCreate() {
    setEditId(null);
    const next = createEmptyForm();
    if (preselectedCounterpartyId) {
      const party = counterparties?.find((item) => item.id === parseInt(preselectedCounterpartyId));
      if (party) {
        next.buyerId = String(party.id);
        next.buyerName = party.shortName ?? party.name;
        next.payerId = String(party.id);
        next.payerName = party.shortName ?? party.name;
        next.unloadingAddress = party.actualAddress ?? party.legalAddress ?? "";
      }
    }
    setForm(next);
    setDialogOpen(true);
  }

  function openEdit(waybill: any) {
    setEditId(waybill.id);
    setForm({
      specificationId: waybill.specificationId ? String(waybill.specificationId) : "",
      contractId: waybill.contractId ? String(waybill.contractId) : "",
      supplierId: waybill.supplierId ? String(waybill.supplierId) : "",
      supplierName: waybill.supplierName ?? "",
      loadingAddress: waybill.loadingAddress ?? "",
      buyerId: waybill.buyerId ? String(waybill.buyerId) : "",
      buyerName: waybill.buyerName ?? "",
      unloadingAddress: waybill.unloadingAddress ?? "",
      carrierId: waybill.carrierId ? String(waybill.carrierId) : "",
      carrierName: waybill.carrierName ?? "",
      vehicleOwnerId: waybill.vehicleOwnerId ? String(waybill.vehicleOwnerId) : "",
      vehicleOwnerName: waybill.vehicleOwnerName ?? "",
      payerId: waybill.payerId ? String(waybill.payerId) : "",
      payerName: waybill.payerName ?? "",
      driverName: waybill.driverName ?? "",
      vehicleMake: waybill.vehicleMake ?? "",
      tractorNumber: waybill.tractorNumber ?? "",
      trailerNumber: waybill.trailerNumber ?? "",
      tripSheetNumber: waybill.tripSheetNumber ?? "",
      routeNumber: waybill.routeNumber ?? "",
      garageNumber: waybill.garageNumber ?? "",
      grossWeight: waybill.grossWeight ?? "",
      tareWeight: waybill.tareWeight ?? "",
      netWeight: waybill.netWeight ?? "",
      cargoName: waybill.cargoName ?? "",
      cargoGrade: waybill.cargoGrade ?? "",
      impurityPercent: waybill.impurityPercent ?? "",
      moisturePercent: waybill.moisturePercent ?? "",
      packageType: waybill.packageType ?? "н/у",
      quantity: waybill.quantity ?? "",
      cargoClass: waybill.cargoClass ?? "",
      pricePerUnit: waybill.pricePerUnit ?? "",
      currency: waybill.currency ?? "RUB",
      status: waybill.status ?? "draft",
      waybillDate: waybill.waybillDate
        ? new Date(waybill.waybillDate).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      declarationInfo: waybill.declarationInfo ?? "",
      notes: waybill.notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleContractChange(contractId: string) {
    const row = contracts?.find((item) => item.contract.id === parseInt(contractId));
    const party = row ? counterparties?.find((item) => item.id === row.contract.counterpartyId) : undefined;
    setForm((previous) => {
      const keepsSpecification = Boolean(
        previous.specificationId &&
        specifications?.some(
          (item) => String(item.specification.id) === previous.specificationId && String(item.specification.contractId) === contractId
        )
      );
      const clearsPreviousSpecification = Boolean(previous.specificationId) && !keepsSpecification;

      return {
        ...previous,
        contractId,
        specificationId: keepsSpecification ? previous.specificationId : "",
        supplierId: party ? String(party.id) : "",
        supplierName: party ? party.shortName ?? party.name : "",
        loadingAddress: keepsSpecification ? previous.loadingAddress : party?.actualAddress || party?.legalAddress || "",
        ...(clearsPreviousSpecification
          ? { unloadingAddress: "", cargoName: "", pricePerUnit: "", currency: "RUB" }
          : {}),
      };
    });
  }

  function handleSpecChange(specificationId: string) {
    const row = specifications?.find((item) => item.specification.id === parseInt(specificationId));
    if (!row) {
      setForm((previous) => ({ ...previous, specificationId }));
      return;
    }

    const specification = row.specification;
    const party = row.counterparty;
    setForm((previous) => ({
      ...previous,
      specificationId,
      contractId: String(specification.contractId),
      loadingAddress: specification.loadingAddress ?? previous.loadingAddress,
      unloadingAddress: specification.unloadingAddress ?? previous.unloadingAddress,
      cargoName: specification.cargoName ?? previous.cargoName,
      pricePerUnit: specification.pricePerUnit ?? previous.pricePerUnit,
      currency: specification.currency ?? previous.currency,
      supplierId: party ? String(party.id) : previous.supplierId,
      supplierName: party ? party.shortName ?? party.name : previous.supplierName,
    }));
  }

  function applyCounterparty(role: PartyRole, id: string, party: any) {
    const name = party.shortName ?? party.name;
    const address = party.actualAddress ?? party.legalAddress ?? "";

    setForm((previous) => {
      if (role === "supplier") {
        return { ...previous, supplierId: id, supplierName: name, loadingAddress: previous.loadingAddress || address };
      }
      if (role === "buyer") {
        return {
          ...previous,
          buyerId: id,
          buyerName: name,
          unloadingAddress: previous.unloadingAddress || address,
          payerId: previous.payerId || id,
          payerName: previous.payerName || name,
        };
      }
      if (role === "carrier") {
        return {
          ...previous,
          carrierId: id,
          carrierName: name,
          vehicleOwnerId: previous.vehicleOwnerId || id,
          vehicleOwnerName: previous.vehicleOwnerName || name,
        };
      }
      if (role === "vehicleOwner") {
        return { ...previous, vehicleOwnerId: id, vehicleOwnerName: name };
      }
      return { ...previous, payerId: id, payerName: name };
    });
  }

  function handlePartySelect(role: PartyRole, id: string) {
    if (id === "manual") {
      setForm((previous) => {
        if (role === "supplier") return { ...previous, supplierId: "" };
        if (role === "buyer") return { ...previous, buyerId: "" };
        if (role === "carrier") return { ...previous, carrierId: "" };
        if (role === "vehicleOwner") return { ...previous, vehicleOwnerId: "" };
        return { ...previous, payerId: "" };
      });
      return;
    }
    const party = counterparties?.find((item) => item.id === parseInt(id));
    if (party) applyCounterparty(role, id, party);
  }

  function setManualPartyName(role: PartyRole, value: string) {
    setForm((previous) => {
      if (role === "supplier") return { ...previous, supplierName: value };
      if (role === "buyer") return { ...previous, buyerName: value };
      if (role === "carrier") return { ...previous, carrierName: value };
      if (role === "vehicleOwner") return { ...previous, vehicleOwnerName: value };
      return { ...previous, payerName: value };
    });
  }

  function openQuickParty(role: PartyRole) {
    setQuickPartyRole(role);
    setQuickParty(quickPartyEmpty);
    setQuickPartyOpen(true);
  }

  function handleQuickPartySubmit() {
    if (!quickParty.name.trim()) {
      toast.error("Укажите полное наименование");
      return;
    }
    createPartyMutation.mutate({
      name: quickParty.name.trim(),
      shortName: quickParty.shortName || undefined,
      type: quickParty.type,
      inn: quickParty.inn || undefined,
      okpo: quickParty.okpo || undefined,
      legalAddress: quickParty.legalAddress || undefined,
      actualAddress: quickParty.actualAddress || undefined,
      phone: quickParty.phone || undefined,
    });
  }

  function handleWeightChange(key: "grossWeight" | "tareWeight", value: string) {
    setForm((previous) => {
      const next = { ...previous, [key]: value };
      const gross = Number(key === "grossWeight" ? value : previous.grossWeight);
      const tare = Number(key === "tareWeight" ? value : previous.tareWeight);
      if (Number.isFinite(gross) && Number.isFinite(tare) && gross >= tare && gross > 0) {
        next.netWeight = (gross - tare).toFixed(3);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (!form.contractId) return toast.error("Выберите договор");
    if (!form.supplierName.trim()) return toast.error("Укажите поставщика / грузоотправителя");
    if (!form.buyerName.trim()) return toast.error("Укажите грузополучателя");
    if (!form.carrierName.trim()) return toast.error("Укажите перевозчика");
    if (!form.cargoName.trim()) return toast.error("Укажите наименование груза");
    if (form.grossWeight && form.tareWeight && Number(form.grossWeight) < Number(form.tareWeight)) {
      return toast.error("Брутто не может быть меньше тары");
    }

    const optionalNumber = (value: string) => (value ? parseInt(value) : undefined);
    const optionalText = (value: string) => value || undefined;
    const data = {
      specificationId: optionalNumber(form.specificationId),
      contractId: optionalNumber(form.contractId),
      supplierId: optionalNumber(form.supplierId),
      supplierName: optionalText(form.supplierName),
      loadingAddress: optionalText(form.loadingAddress),
      buyerId: optionalNumber(form.buyerId),
      buyerName: optionalText(form.buyerName),
      unloadingAddress: optionalText(form.unloadingAddress),
      carrierId: optionalNumber(form.carrierId),
      carrierName: optionalText(form.carrierName),
      vehicleOwnerId: optionalNumber(form.vehicleOwnerId),
      vehicleOwnerName: optionalText(form.vehicleOwnerName),
      payerId: optionalNumber(form.payerId),
      payerName: optionalText(form.payerName),
      driverName: optionalText(form.driverName),
      vehicleMake: optionalText(form.vehicleMake),
      tractorNumber: optionalText(form.tractorNumber),
      trailerNumber: optionalText(form.trailerNumber),
      tripSheetNumber: optionalText(form.tripSheetNumber),
      routeNumber: optionalText(form.routeNumber),
      garageNumber: optionalText(form.garageNumber),
      grossWeight: optionalText(form.grossWeight),
      tareWeight: optionalText(form.tareWeight),
      netWeight: optionalText(form.netWeight),
      cargoName: optionalText(form.cargoName),
      cargoGrade: optionalText(form.cargoGrade),
      impurityPercent: optionalText(form.impurityPercent),
      moisturePercent: optionalText(form.moisturePercent),
      packageType: optionalText(form.packageType),
      quantity: optionalText(form.quantity),
      cargoClass: optionalText(form.cargoClass),
      pricePerUnit: optionalText(form.pricePerUnit),
      currency: form.currency,
      status: form.status,
      waybillDate: form.waybillDate ? new Date(form.waybillDate) : undefined,
      declarationInfo: optionalText(form.declarationInfo),
      notes: optionalText(form.notes),
    };

    if (editId) updateMutation.mutate({ id: editId, data });
    else {
      createMutation.mutate({
        ...data,
        contractId: parseInt(form.contractId),
        supplierName: form.supplierName.trim(),
        buyerName: form.buyerName.trim(),
        carrierName: form.carrierName.trim(),
        cargoName: form.cargoName.trim(),
      });
    }
  }

  const field =
    (key: keyof FormState) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((previous) => ({ ...previous, [key]: event.target.value }));

  const filteredSpecifications = form.contractId
    ? specifications?.filter((item) => String(item.specification.contractId) === form.contractId)
    : specifications;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Накладные
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{list?.length ?? 0} документов</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Оформить ТТН
        </Button>
      </div>

      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по номеру или участнику..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter || "all"} onValueChange={(value) => setStatusFilter(value === "all" ? "" : value)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Все статусы" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(WAYBILL_STATUSES).map(([key, value]) => (
              <SelectItem key={key} value={key}>{value.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Загрузка...</div>
        ) : !list?.length ? (
          <div className="p-12 text-center">
            <Truck className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Накладные не найдены</p>
            <Button variant="outline" size="sm" onClick={openCreate} className="mt-4">Оформить первую</Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">№ ТТН</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Отправитель → получатель</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">Перевозчик</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden xl:table-cell">Нетто</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Статус</th>
                <th className="px-4 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((waybill) => {
                const statusInfo = WAYBILL_STATUSES[waybill.status as keyof typeof WAYBILL_STATUSES];
                return (
                  <tr key={waybill.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => setDetailsId(waybill.id)} className="text-left">
                        <p className="text-sm font-medium font-mono hover:text-primary">№ {waybill.number}</p>
                        <p className="text-xs text-muted-foreground">{waybill.cargoName || formatDate(waybill.waybillDate)}</p>
                      </button>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-sm">
                      {waybill.supplierName ?? "—"} <span className="text-muted-foreground">→</span> {waybill.buyerName ?? "—"}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <p className="text-sm">{waybill.carrierName ?? "—"}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {[waybill.tractorNumber, waybill.trailerNumber].filter(Boolean).join(" / ")}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell text-sm">{formatWeight(waybill.netWeight)}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="cursor-pointer">
                            <StatusBadge label={statusInfo?.label ?? waybill.status} color={statusInfo?.color ?? "bg-slate-100 text-slate-600"} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {Object.entries(WAYBILL_STATUSES).map(([key, value]) => (
                            <DropdownMenuItem key={key} onClick={() => updateStatusMutation.mutate({ id: waybill.id, status: key as WaybillStatus })}>
                              <StatusBadge label={value.label} color={value.color} />
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-all">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailsId(waybill.id)}><Eye className="mr-2" /> Связи и участники</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(waybill)}><Pencil className="mr-2" /> Редактировать</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => window.open(`/api/waybills/${waybill.id}/print`, "_blank")}><Printer className="mr-2" /> Итоговая ТТН по образцу</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { window.location.href = `/api/waybills/${waybill.id}/print?download=1`; }}><Download className="mr-2" /> Скачать печатную форму</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { window.location.href = `/api/waybills/${waybill.id}/xlsx`; }}><FileSpreadsheet className="mr-2" /> Скачать XLSX</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => {
                            if (confirm("Удалить накладную?")) deleteMutation.mutate({ id: waybill.id });
                          }}>
                            <Trash2 className="mr-2" /> Удалить
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[94vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать ТТН" : "Новая товарно-транспортная накладная"}</DialogTitle>
            <DialogDescription>Выберите договор и участников. Сохранённые данные и последний транспорт перевозчика подставятся автоматически.</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            <section className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3"><Link2 className="text-primary" /><h2 className="text-sm font-semibold">Основа документа</h2></div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.25fr)_minmax(10rem,1fr)]">
                <div className="min-w-0">
                  <Label>Договор *</Label>
                  <Select value={form.contractId} onValueChange={handleContractChange}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Выберите договор" /></SelectTrigger>
                    <SelectContent>
                      {contracts?.map((row) => (
                        <SelectItem key={row.contract.id} value={String(row.contract.id)}>
                          {row.contract.number}{row.counterparty ? ` — ${row.counterparty.shortName ?? row.counterparty.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label>Спецификация</Label>
                  <Select value={form.specificationId || "none"} onValueChange={(value) => handleSpecChange(value === "none" ? "" : value)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Необязательно" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— Без спецификации —</SelectItem>
                      {filteredSpecifications?.map((row) => (
                        <SelectItem key={row.specification.id} value={String(row.specification.id)}>{row.specification.number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-0">
                  <Label>Дата ТТН</Label>
                  <Input type="date" value={form.waybillDate} onChange={field("waybillDate")} className="mt-1" />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3"><Building2 className="text-teal-600" /><h2 className="text-sm font-semibold">Участники перевозки</h2></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PartySelector label={partyLabels.supplier} value={form.supplierId} manualName={form.supplierName} counterparties={counterparties} onSelect={(value) => handlePartySelect("supplier", value)} onManualName={(value) => setManualPartyName("supplier", value)} onAdd={() => openQuickParty("supplier")} />
                <PartySelector label={partyLabels.buyer} value={form.buyerId} manualName={form.buyerName} counterparties={counterparties} onSelect={(value) => handlePartySelect("buyer", value)} onManualName={(value) => setManualPartyName("buyer", value)} onAdd={() => openQuickParty("buyer")} />
                <PartySelector label={partyLabels.carrier} value={form.carrierId} manualName={form.carrierName} counterparties={counterparties} onSelect={(value) => handlePartySelect("carrier", value)} onManualName={(value) => setManualPartyName("carrier", value)} onAdd={() => openQuickParty("carrier")} />
                <PartySelector label={partyLabels.vehicleOwner} value={form.vehicleOwnerId} manualName={form.vehicleOwnerName} counterparties={counterparties} onSelect={(value) => handlePartySelect("vehicleOwner", value)} onManualName={(value) => setManualPartyName("vehicleOwner", value)} onAdd={() => openQuickParty("vehicleOwner")} />
                <PartySelector label={partyLabels.payer} value={form.payerId} manualName={form.payerName} counterparties={counterparties} onSelect={(value) => handlePartySelect("payer", value)} onManualName={(value) => setManualPartyName("payer", value)} onAdd={() => openQuickParty("payer")} />
                <div>
                  <Label>Водитель</Label>
                  <Input value={form.driverName} onChange={field("driverName")} placeholder="Фамилия, имя, отчество" className="mt-1" />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3"><Truck className="text-violet-600" /><h2 className="text-sm font-semibold">Транспорт и маршрут</h2></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label>Марка автомобиля</Label><Input value={form.vehicleMake} onChange={field("vehicleMake")} className="mt-1" /></div>
                <div><Label>Госномер тягача</Label><Input value={form.tractorNumber} onChange={field("tractorNumber")} className="mt-1 font-mono uppercase" /></div>
                <div><Label>Госномер прицепа</Label><Input value={form.trailerNumber} onChange={field("trailerNumber")} className="mt-1 font-mono uppercase" /></div>
                <div><Label>Гаражный номер</Label><Input value={form.garageNumber} onChange={field("garageNumber")} className="mt-1" /></div>
                <div><Label>Путевой лист №</Label><Input value={form.tripSheetNumber} onChange={field("tripSheetNumber")} className="mt-1" /></div>
                <div><Label>Маршрут №</Label><Input value={form.routeNumber} onChange={field("routeNumber")} className="mt-1" /></div>
                <div className="col-span-2"><Label>Пункт погрузки</Label><Input value={form.loadingAddress} onChange={field("loadingAddress")} className="mt-1" /></div>
                <div className="col-span-2"><Label>Пункт разгрузки</Label><Input value={form.unloadingAddress} onChange={field("unloadingAddress")} className="mt-1" /></div>
              </div>
            </section>

            <section className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3"><Package className="text-amber-600" /><h2 className="text-sm font-semibold">Груз и весовые характеристики</h2></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="col-span-2"><Label>Наименование культуры *</Label><Input value={form.cargoName} onChange={field("cargoName")} className="mt-1" /></div>
                <div><Label>Сорт, класс</Label><Input value={form.cargoGrade} onChange={field("cargoGrade")} className="mt-1" /></div>
                <div><Label>Класс груза</Label><Input value={form.cargoClass} onChange={field("cargoClass")} className="mt-1" /></div>
                <div><Label>Засорённость, %</Label><Input value={form.impurityPercent} onChange={field("impurityPercent")} type="number" step="0.01" className="mt-1" /></div>
                <div><Label>Влажность, %</Label><Input value={form.moisturePercent} onChange={field("moisturePercent")} type="number" step="0.01" className="mt-1" /></div>
                <div><Label>Вид упаковки</Label><Input value={form.packageType} onChange={field("packageType")} className="mt-1" /></div>
                <div><Label>Количество</Label><Input value={form.quantity} onChange={field("quantity")} type="number" step="0.001" className="mt-1" /></div>
                <div><Label>Брутто, т</Label><Input value={form.grossWeight} onChange={(event) => handleWeightChange("grossWeight", event.target.value)} type="number" step="0.001" className="mt-1 font-mono" /></div>
                <div><Label>Тара, т</Label><Input value={form.tareWeight} onChange={(event) => handleWeightChange("tareWeight", event.target.value)} type="number" step="0.001" className="mt-1 font-mono" /></div>
                <div><Label>Нетто, т</Label><Input value={form.netWeight} onChange={field("netWeight")} type="number" step="0.001" className="mt-1 font-mono bg-muted/50" /></div>
                <div><Label>Цена за тонну, руб.</Label><Input value={form.pricePerUnit} onChange={field("pricePerUnit")} type="number" step="0.01" className="mt-1" /></div>
              </div>
            </section>

            <section className="rounded-xl border border-border p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><Label>Декларации, сертификаты, приложения</Label><Textarea value={form.declarationInfo} onChange={field("declarationInfo")} rows={2} className="mt-1 resize-none" /></div>
                <div><Label>Примечания</Label><Textarea value={form.notes} onChange={field("notes")} rows={2} className="mt-1 resize-none" /></div>
                <div>
                  <Label>Статус</Label>
                  <Select value={form.status} onValueChange={(value) => setForm((previous) => ({ ...previous, status: value as WaybillStatus }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(WAYBILL_STATUSES).map(([key, value]) => <SelectItem key={key} value={key}>{value.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editId ? "Сохранить" : "Создать ТТН"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={quickPartyOpen} onOpenChange={setQuickPartyOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Новый контрагент</DialogTitle>
            <DialogDescription>После сохранения будет выбран как «{partyLabels[quickPartyRole]}».</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Полное наименование *</Label><Input value={quickParty.name} onChange={(event) => setQuickParty((previous) => ({ ...previous, name: event.target.value }))} className="mt-1" /></div>
            <div><Label>Краткое наименование</Label><Input value={quickParty.shortName} onChange={(event) => setQuickParty((previous) => ({ ...previous, shortName: event.target.value }))} className="mt-1" /></div>
            <div>
              <Label>Тип</Label>
              <Select value={quickParty.type} onValueChange={(value) => setQuickParty((previous) => ({ ...previous, type: value as CounterpartyType }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="legal">Организация</SelectItem><SelectItem value="sole_trader">ИП</SelectItem><SelectItem value="individual">Физлицо</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>ИНН</Label><Input value={quickParty.inn} onChange={(event) => setQuickParty((previous) => ({ ...previous, inn: event.target.value }))} className="mt-1 font-mono" /></div>
            <div><Label>ОКПО</Label><Input value={quickParty.okpo} onChange={(event) => setQuickParty((previous) => ({ ...previous, okpo: event.target.value }))} className="mt-1 font-mono" /></div>
            <div className="col-span-2"><Label>Юридический адрес</Label><Input value={quickParty.legalAddress} onChange={(event) => setQuickParty((previous) => ({ ...previous, legalAddress: event.target.value }))} className="mt-1" /></div>
            <div className="col-span-2"><Label>Фактический адрес</Label><Input value={quickParty.actualAddress} onChange={(event) => setQuickParty((previous) => ({ ...previous, actualAddress: event.target.value }))} className="mt-1" /></div>
            <div><Label>Телефон</Label><Input value={quickParty.phone} onChange={(event) => setQuickParty((previous) => ({ ...previous, phone: event.target.value }))} className="mt-1" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickPartyOpen(false)}>Отмена</Button>
            <Button onClick={handleQuickPartySubmit} disabled={createPartyMutation.isPending}>Добавить и выбрать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsId !== null} onOpenChange={(open) => !open && setDetailsId(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Связи и участники ТТН № {details?.waybill.number ?? ""}</DialogTitle>
            <DialogDescription>Все документы и стороны, задействованные в этой перевозке.</DialogDescription>
          </DialogHeader>
          {details && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Договор</p>
                  <p className="mt-1 text-sm font-medium">{details.contract?.number ?? "Не указан"}</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Спецификация</p>
                  <p className="mt-1 text-sm font-medium">{details.specification?.number ?? "Не указана"}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <DetailParty label={partyLabels.supplier} party={details.supplier} fallback={details.waybill.supplierName} />
                <DetailParty label={partyLabels.buyer} party={details.buyer} fallback={details.waybill.buyerName} />
                <DetailParty label={partyLabels.carrier} party={details.carrier} fallback={details.waybill.carrierName} />
                <DetailParty label={partyLabels.vehicleOwner} party={details.vehicleOwner} fallback={details.waybill.vehicleOwnerName} />
                <DetailParty label={partyLabels.payer} party={details.payer} fallback={details.waybill.payerName} />
                <div className="rounded-lg border border-border p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Водитель и транспорт</p>
                  <p className="mt-1 text-sm font-medium">{details.waybill.driverName || "Не указан"}</p>
                  <p className="text-xs text-muted-foreground">{[details.waybill.vehicleMake, details.waybill.tractorNumber, details.waybill.trailerNumber].filter(Boolean).join(" / ")}</p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            {detailsId && <Button variant="outline" onClick={() => window.open(`/api/waybills/${detailsId}/print`, "_blank")}><Printer /> Печатная форма СП-31</Button>}
            <Button onClick={() => setDetailsId(null)}>Закрыть</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
