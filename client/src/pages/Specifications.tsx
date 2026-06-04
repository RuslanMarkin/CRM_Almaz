import { trpc } from "@/lib/trpc";
import { SPEC_STATUSES, formatDate, formatCurrency, formatVolume } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
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
    onSuccess: () => {
      utils.specifications.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Спецификация создана");
    },
    onError: (e) => toast.error(e.message),
  });

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
    onSuccess: () => {
      utils.specifications.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Спецификация удалена");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: any) {
    const s = row.specification;
    setEditId(s.id);
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
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.number.trim()) { toast.error("Укажите номер спецификации"); return; }
    if (!form.contractId) { toast.error("Выберите договор"); return; }
    if (!form.counterpartyId) { toast.error("Выберите контрагента"); return; }
    const data = {
      ...form,
      contractId: parseInt(form.contractId),
      counterpartyId: parseInt(form.counterpartyId),
      startDate: form.startDate ? new Date(form.startDate) : undefined,
      endDate: form.endDate ? new Date(form.endDate) : undefined,
      pricePerUnit: form.pricePerUnit || undefined,
      volumeTotal: form.volumeTotal || undefined,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate(data);
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
                          <p className="text-xs text-muted-foreground">
                            {formatCurrency(spec.pricePerUnit)} / {spec.unit}
                          </p>
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
                          <button className="p-1.5 rounded-md hover:bg-muted text-muted-foreground opacity-0 group-hover:opacity-100 transition-all">
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                <div>
                  <Label>Цена за единицу</Label>
                  <Input value={form.pricePerUnit} onChange={f("pricePerUnit")} placeholder="0.00" type="number" className="mt-1" />
                </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {editId ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
