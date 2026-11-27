import { trpc } from "@/lib/trpc";
import { SPEC_STATUSES, formatDate, formatCurrency, formatVolume } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { ScanAttachments, type StagedAttachment } from "@/components/ScanAttachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { ScrollText, Plus, Search, Pencil, Trash2, MoreHorizontal, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

type SpecStatus = "draft" | "active" | "completed" | "cancelled";

interface FormState {
  number: string;
  contractId: string;
  counterpartyId: string;
  loadingAddress: string;
  unloadingAddress: string;
  cargoName: string;
  pricePerUnit: string;
  unit: string;
  currency: string;
  volumeTotal: string;
  volumeShipped: string;
  startDate: string;
  endDate: string;
  status: SpecStatus;
  notes: string;
  vatRate: string;
}

const emptyForm: FormState = {
  number: "",
  contractId: "",
  counterpartyId: "",
  loadingAddress: "",
  unloadingAddress: "",
  cargoName: "",
  pricePerUnit: "",
  unit: "т",
  currency: "RUB",
  volumeTotal: "",
  volumeShipped: "0",
  startDate: "",
  endDate: "",
  status: "draft",
  notes: "",
  vatRate: "10",
};

export default function Specifications() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);

  const preselectedCounterpartyId = params.get("counterpartyId");
  const shouldAutoOpenCreate = params.get("create") === "1";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [stagedScans, setStagedScans] = useState<StagedAttachment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAutoOpenedCreate, setHasAutoOpenedCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const utils = trpc.useUtils();

  const { data: list, isLoading } = trpc.specifications.list.useQuery({
    search: search || undefined,
    status: statusFilter || undefined,
    counterpartyId: preselectedCounterpartyId ? parseInt(preselectedCounterpartyId) : undefined,
  });

  const { data: contracts } = trpc.contracts.list.useQuery({});
  const { data: counterparties } = trpc.counterparties.list.useQuery({});

  const createMutation = trpc.specifications.create.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const createAttachmentMutation = trpc.attachments.create.useMutation();

  const updateMutation = trpc.specifications.update.useMutation({
    onSuccess: () => {
      utils.specifications.list.invalidate();
      setDialogOpen(false);
      setEditId(null);
      toast.success("Спецификация обновлена");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.specifications.updateStatus.useMutation({
    onSuccess: () => {
      utils.specifications.list.invalidate();
      toast.success("Статус обновлён");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.specifications.delete.useMutation({
    onSuccess: (_, variables) => {
      utils.specifications.list.invalidate();
      utils.deals.list.invalidate();
      utils.recycleBin.list.invalidate();
      utils.dashboard.stats.invalidate();
      if (editId === variables.id) {
        setDialogOpen(false);
        setEditId(null);
        setStagedScans([]);
      }
      toast.success("Спецификация удалена");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setStagedScans([]);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: any) {
    const s = row.specification;
    setEditId(s.id);
    setStagedScans([]);
    setForm({
      number: s.number ?? "",
      contractId: String(s.contractId ?? ""),
      counterpartyId: String(s.counterpartyId ?? ""),
      loadingAddress: s.loadingAddress ?? "",
      unloadingAddress: s.unloadingAddress ?? "",
      cargoName: s.cargoName ?? "",
      pricePerUnit: s.pricePerUnit ?? "",
      unit: s.unit ?? "т",
      currency: s.currency ?? "RUB",
      volumeTotal: s.volumeTotal ?? "",
      volumeShipped: s.volumeShipped ?? "0",
      startDate: s.startDate ? new Date(s.startDate).toISOString().split("T")[0] : "",
      endDate: s.endDate ? new Date(s.endDate).toISOString().split("T")[0] : "",
      status: s.status ?? "draft",
      notes: s.notes ?? "",
      vatRate: s.vatRate ?? "10",
    });
    setDialogOpen(true);
  }

  async function handleSubmit() {
    if (!form.number.trim()) { toast.error("Укажите номер спецификации"); return; }
    if (!form.contractId) { toast.error("Выберите договор"); return; }
    if (!form.counterpartyId) { toast.error("Выберите контрагента"); return; }
    const contractIdNum = parseInt(form.contractId);
    const data = {
      ...form,
      contractId: contractIdNum,
      counterpartyId: parseInt(form.counterpartyId),
      startDate: form.startDate ? new Date(form.startDate) : undefined,
      endDate: form.endDate ? new Date(form.endDate) : undefined,
      pricePerUnit: form.pricePerUnit || undefined,
      volumeTotal: form.volumeTotal || undefined,
      vatRate: form.vatRate || "10",
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data });
    } else {
      setIsSubmitting(true);
      try {
        const created = await createMutation.mutateAsync(data);
        const specId = created?.specification?.id;
        if (stagedScans.length > 0) {
          for (const scan of stagedScans) {
            try {
              await createAttachmentMutation.mutateAsync({
                entityType: "contract",
                entityId: contractIdNum,
                specificationId: specId,
                documentKind: "specification_scan",
                fileName: scan.fileName,
                contentType: scan.contentType,
                size: scan.size,
                dataUrl: scan.dataUrl,
              });
            } catch (err) {
              console.error("Failed to upload scan", err);
              toast.error(`Не удалось сохранить скан ${scan.fileName}`);
            }
          }
        }
        utils.specifications.list.invalidate();
        utils.dashboard.stats.invalidate();
        setDialogOpen(false);
        setForm(emptyForm);
        setStagedScans([]);
        toast.success("Спецификация создана");
      } catch (e: any) {
        toast.error(e?.message || "Ошибка при создании спецификации");
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  // Auto-fill counterparty from contract
  function handleContractChange(contractId: string) {
    const contract = contracts?.find((c) => c.contract.id === parseInt(contractId));
    setForm((p) => ({
      ...p,
      contractId,
      counterpartyId: contract ? String(contract.contract.counterpartyId) : p.counterpartyId,
    }));
  }

  const f = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [key]: e.target.value }));

  useEffect(() => {
    if (!shouldAutoOpenCreate) {
      setHasAutoOpenedCreate(false);
      return;
    }
    if (hasAutoOpenedCreate) return;
    setEditId(null);
    setForm({ ...emptyForm, counterpartyId: preselectedCounterpartyId ?? "" });
    setDialogOpen(true);
    setHasAutoOpenedCreate(true);
  }, [hasAutoOpenedCreate, preselectedCounterpartyId, shouldAutoOpenCreate]);

  const numPrice = Number(form.pricePerUnit) || 0;
  const numVolume = Number(form.volumeTotal) || 0;
  const numVatRate = Number(form.vatRate) || 0;
  const vatPerUnit = numPrice * (numVatRate / 100);
  const priceWithVat = numPrice + vatPerUnit;
  const totalWithoutVat = numVolume * numPrice;
  const totalVat = numVolume * vatPerUnit;
  const totalWithVat = numVolume * priceWithVat;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Спецификации
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{list?.length ?? 0} документов</p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Создать
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по номеру..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Все статусы" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(SPEC_STATUSES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Загрузка...</div>
        ) : !list?.length ? (
          <div className="p-12 text-center">
            <ScrollText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Спецификации не найдены</p>
            <Button variant="outline" size="sm" onClick={openCreate} className="mt-4">Создать первую</Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Номер</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Контрагент</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Груз</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Объём (отгружено / остаток)</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Статус</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((row) => {
                const spec = row.specification;
                const cp = row.counterparty;
                const contract = row.contract;
                const statusInfo = SPEC_STATUSES[spec.status as keyof typeof SPEC_STATUSES];
                const shipped = parseFloat(spec.volumeShipped ?? "0");
                const total = parseFloat(spec.volumeTotal ?? "0");
                const remaining = total > 0 ? total - shipped : null;
                const pct = total > 0 ? Math.min(100, (shipped / total) * 100) : 0;
                return (
                  <tr key={spec.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <ScrollText className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{spec.number}</p>
                          {contract && (
                            <p className="text-xs text-muted-foreground">Дог. {contract.number}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {cp ? (
                        <Link href={`/counterparties/${cp.id}`} className="text-sm text-foreground hover:text-primary transition-colors">
                            {cp.shortName ?? cp.name}
                        </Link>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <div>
                        <p className="text-sm text-foreground">{spec.cargoName ?? "—"}</p>
                        {spec.pricePerUnit && (
                          <div className="text-xs">
                            <span className="text-muted-foreground">{formatCurrency(spec.pricePerUnit)} / {spec.unit} (без НДС)</span>
                            {Number((spec as any).vatRate ?? 0) > 0 ? (
                              <span className="text-emerald-700 font-medium block text-[11.5px]">
                                {formatCurrency(Number(spec.pricePerUnit) * (1 + Number((spec as any).vatRate) / 100))} (с НДС {(spec as any).vatRate}%)
                              </span>
                            ) : (
                              <span className="text-slate-500 block text-[11px]">Без НДС</span>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {total > 0 ? (
                        <div className="min-w-[160px]">
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-muted-foreground">
                              отгружено: <span className="font-medium text-foreground">{formatVolume(shipped)} {spec.unit}</span>
                            </span>
                            <span className="text-muted-foreground">
                              остаток: <span className="font-medium text-foreground">{formatVolume(remaining ?? 0)} {spec.unit}</span>
                            </span>
                          </div>
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Всего: {formatVolume(total)} {spec.unit}
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="cursor-pointer">
                            <StatusBadge
                              label={statusInfo?.label ?? spec.status}
                              color={statusInfo?.color ?? "bg-slate-100 text-slate-600"}
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {Object.entries(SPEC_STATUSES).map(([k, v]) => (
                            <DropdownMenuItem
                              key={k}
                              onClick={() => updateStatusMutation.mutate({ id: spec.id, status: k as SpecStatus })}
                            >
                              <StatusBadge label={v.label} color={v.color} />
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={`Действия со спецификацией ${spec.number}`}
                            title="Действия"
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground opacity-70 hover:opacity-100 transition-all"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(row)}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Редактировать
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm("Удалить спецификацию?")) deleteMutation.mutate({ id: spec.id }); }}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Удалить
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

      {/* Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditId(null);
            setStagedScans([]);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать спецификацию" : "Новая спецификация"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Номер спецификации *</Label>
                <Input value={form.number} onChange={f("number")} placeholder="СП-2025/001" className="mt-1" />
              </div>
              <div>
                <Label>Статус</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as SpecStatus }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SPEC_STATUSES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Договор *</Label>
              <Select value={form.contractId} onValueChange={handleContractChange}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Выберите договор" /></SelectTrigger>
                <SelectContent>
                  {contracts?.map((row) => (
                    <SelectItem key={row.contract.id} value={String(row.contract.id)}>
                      {row.contract.number}
                      {row.counterparty && <span className="text-muted-foreground ml-2">({row.counterparty.shortName ?? row.counterparty.name})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Контрагент *</Label>
              <Select value={form.counterpartyId} onValueChange={(v) => setForm((p) => ({ ...p, counterpartyId: v }))}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Выберите контрагента" /></SelectTrigger>
                <SelectContent>
                  {counterparties?.map((cp) => (
                    <SelectItem key={cp.id} value={String(cp.id)}>
                      {cp.shortName ?? cp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Адреса</p>
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Адрес погрузки</Label>
                  <Input value={form.loadingAddress} onChange={f("loadingAddress")} placeholder="г. Москва, ул. Складская, д. 1" className="mt-1" />
                </div>
                <div>
                  <Label>Адрес выгрузки</Label>
                  <Input value={form.unloadingAddress} onChange={f("unloadingAddress")} placeholder="г. Санкт-Петербург, ул. Портовая, д. 5" className="mt-1" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Груз и цена</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label>Наименование груза</Label>
                  <Input value={form.cargoName} onChange={f("cargoName")} placeholder="Зерно пшеница" className="mt-1" />
                </div>
                <div>
                  <Label>Единица</Label>
                  <Input value={form.unit} onChange={f("unit")} placeholder="т" className="mt-1" />
                </div>
                <div className="col-span-3">
                  <Label>Цена за единицу (без НДС), ₽</Label>
                  <Input value={form.pricePerUnit} onChange={f("pricePerUnit")} placeholder="0.00" type="number" step="any" className="mt-1" />
                </div>
              </div>

              {/* Плашка НДС с автоматическим пересчётом */}
              <div className="mt-3 rounded-lg border border-amber-300/80 bg-amber-50/70 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-950">
                      Ставка НДС
                    </span>
                    <span className="text-[11px] text-amber-800">
                      (выберите процент или укажите свой):
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: "Без НДС (0%)", value: "0" },
                      { label: "5%", value: "5" },
                      { label: "10%", value: "10" },
                      { label: "20%", value: "20" },
                      { label: "22%", value: "22" },
                    ].map((rate) => (
                      <button
                        type="button"
                        key={rate.value}
                        onClick={() => setForm((prev) => ({ ...prev, vatRate: rate.value }))}
                        className={`text-xs px-2.5 py-1 rounded-md font-semibold transition-all border ${
                          form.vatRate === rate.value
                            ? "bg-amber-600 text-white border-amber-600 shadow-sm"
                            : "bg-white text-amber-950 border-amber-300 hover:bg-amber-100"
                        }`}
                      >
                        {rate.label}
                      </button>
                    ))}
                    <div className="flex items-center gap-1 bg-white px-2 py-0.5 rounded border border-amber-300">
                      <input
                        type="number"
                        step="any"
                        min="0"
                        max="100"
                        value={form.vatRate}
                        onChange={(e) => setForm((prev) => ({ ...prev, vatRate: e.target.value }))}
                        placeholder="%"
                        className="w-12 text-xs font-semibold text-amber-950 outline-none bg-transparent"
                      />
                      <span className="text-xs font-bold text-amber-800">%</span>
                    </div>
                  </div>
                </div>

                {/* Автоматический пересчёт стоимости */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-amber-200 text-xs">
                  <div className="bg-white/95 p-2 rounded border border-amber-200">
                    <div className="text-muted-foreground text-[10.5px] uppercase">Цена без НДС:</div>
                    <div className="font-bold text-slate-800 text-sm mt-0.5">
                      {numPrice > 0 ? `${numPrice.toLocaleString("ru-RU")} ₽/т` : "0.00 ₽"}
                    </div>
                  </div>
                  <div className="bg-white/95 p-2 rounded border border-amber-200">
                    <div className="text-muted-foreground text-[10.5px] uppercase">
                      НДС ({numVatRate}%):
                    </div>
                    <div className="font-bold text-amber-800 text-sm mt-0.5">
                      {numPrice > 0 && numVatRate > 0
                        ? `+${vatPerUnit.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽/т`
                        : "0.00 ₽"}
                    </div>
                  </div>
                  <div className="bg-white/95 p-2 rounded border border-amber-200">
                    <div className="text-muted-foreground text-[10.5px] uppercase">Цена с НДС:</div>
                    <div className="font-bold text-emerald-700 text-sm mt-0.5">
                      {numPrice > 0
                        ? `${priceWithVat.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽/т`
                        : "0.00 ₽"}
                    </div>
                  </div>
                  <div className="bg-white/95 p-2 rounded border border-amber-200">
                    <div className="text-muted-foreground text-[10.5px] uppercase">
                      Итого с НДС:
                    </div>
                    <div className="font-bold text-emerald-900 text-sm mt-0.5">
                      {totalWithVat > 0
                        ? `${totalWithVat.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
                        : numPrice > 0
                        ? `${priceWithVat.toLocaleString("ru-RU")} ₽/т`
                        : "0.00 ₽"}
                    </div>
                  </div>
                </div>

                {numVolume > 0 && numPrice > 0 && (
                  <div className="text-[11.5px] text-amber-950 bg-white/80 px-2.5 py-1.5 rounded flex justify-between flex-wrap gap-1 border border-amber-200/60">
                    <span>
                      Партия: <b>{numVolume.toLocaleString("ru-RU")} т</b> × <b>{numPrice.toLocaleString("ru-RU")} ₽/т</b> = <b>{totalWithoutVat.toLocaleString("ru-RU")} ₽</b> (без НДС)
                    </span>
                    {numVatRate > 0 && (
                      <span>
                        Сумма НДС ({numVatRate}%): <b>{totalVat.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽</b>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Объёмы</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Общий объём</Label>
                  <Input value={form.volumeTotal} onChange={f("volumeTotal")} placeholder="1000" type="number" className="mt-1" />
                </div>
                <div>
                  <Label>Отгружено</Label>
                  <Input value={form.volumeShipped} onChange={f("volumeShipped")} placeholder="0" type="number" className="mt-1" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Дата начала</Label>
                <Input type="date" value={form.startDate} onChange={f("startDate")} className="mt-1" />
              </div>
              <div>
                <Label>Дата окончания</Label>
                <Input type="date" value={form.endDate} onChange={f("endDate")} className="mt-1" />
              </div>
            </div>

            <div>
              <Label>Примечания</Label>
              <Textarea value={form.notes} onChange={f("notes")} className="mt-1 resize-none" rows={2} />
            </div>

            <ScanAttachments
              entityType="contract"
              entityId={editId ? (form.contractId ? Number(form.contractId) : null) : null}
              documentKind="specification_scan"
              specificationId={editId}
              title="Скан спецификации в договоре"
              stagedFiles={stagedScans}
              onStagedFilesChange={setStagedScans}
            />
          </div>
          <DialogFooter>
            {editId !== null && (
              <Button
                type="button"
                variant="destructive"
                className="sm:mr-auto gap-1.5"
                disabled={deleteMutation.isPending || isSubmitting || updateMutation.isPending}
                onClick={() => {
                  if (confirm("Удалить спецификацию?")) deleteMutation.mutate({ id: editId });
                }}
              >
                <Trash2 className="w-4 h-4" />
                Удалить
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                setEditId(null);
                setStagedScans([]);
              }}
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {isSubmitting ? "Сохранение..." : editId ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
