import { trpc } from "@/lib/trpc";
import { CONTRACT_STATUSES, CONTRACT_TYPES, formatDate, formatCurrency } from "@/lib/utils";
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
import { BookOpen, Plus, Search, ChevronDown, Pencil, Trash2, MoreHorizontal, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

type ContractStatus = "draft" | "active" | "suspended" | "completed" | "terminated";
type ContractType = "framework" | "one_time" | "service";

interface FormState {
  number: string;
  counterpartyId: string;
  type: ContractType;
  subject: string;
  startDate: string;
  endDate: string;
  amount: string;
  currency: string;
  status: ContractStatus;
  notes: string;
}

const emptyForm: FormState = {
  number: "",
  counterpartyId: "",
  type: "framework",
  subject: "",
  startDate: "",
  endDate: "",
  amount: "",
  currency: "RUB",
  status: "draft",
  notes: "",
};

export default function Contracts() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const preselectedCounterpartyId = params.get("counterpartyId");
  const shouldAutoOpenCreate = params.get("create") === "1";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [hasAutoOpenedCreate, setHasAutoOpenedCreate] = useState(false);
  const [statusDialogId, setStatusDialogId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({
    ...emptyForm,
    counterpartyId: preselectedCounterpartyId ?? "",
  });
  const utils = trpc.useUtils();

  const { data: list, isLoading } = trpc.contracts.list.useQuery({
    search: search || undefined,
    status: statusFilter || undefined,
    counterpartyId: preselectedCounterpartyId ? parseInt(preselectedCounterpartyId) : undefined,
  });

  const { data: counterparties } = trpc.counterparties.list.useQuery({});

  const createMutation = trpc.contracts.create.useMutation({
    onSuccess: () => {
      utils.contracts.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Договор создан");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.contracts.update.useMutation({
    onSuccess: () => {
      utils.contracts.list.invalidate();
      setDialogOpen(false);
      setEditId(null);
      toast.success("Договор обновлён");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.contracts.updateStatus.useMutation({
    onSuccess: () => {
      utils.contracts.list.invalidate();
      setStatusDialogId(null);
      toast.success("Статус обновлён");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.contracts.delete.useMutation({
    onSuccess: () => {
      utils.contracts.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Договор удалён");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm({ ...emptyForm, counterpartyId: preselectedCounterpartyId ?? "" });
    setDialogOpen(true);
  }

  function openEdit(row: any) {
    setEditId(row.contract.id);
    setForm({
      number: row.contract.number ?? "",
      counterpartyId: String(row.contract.counterpartyId ?? ""),
      type: row.contract.type ?? "framework",
      subject: row.contract.subject ?? "",
      startDate: row.contract.startDate ? new Date(row.contract.startDate).toISOString().split("T")[0] : "",
      endDate: row.contract.endDate ? new Date(row.contract.endDate).toISOString().split("T")[0] : "",
      amount: row.contract.amount ?? "",
      currency: row.contract.currency ?? "RUB",
      status: row.contract.status ?? "draft",
      notes: row.contract.notes ?? "",
    });
    setDialogOpen(true);
  }

  function openPrintForm(id: number) {
    window.open(`/api/contracts/${id}/print`, "_blank");
  }

  async function openDraftPrintForm() {
    try {
      const cp = counterparties?.find((item) => String(item.id) === form.counterpartyId);
      const response = await fetch("/api/contracts/print-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract: {
            number: form.number,
            type: form.type,
            subject: form.subject,
            startDate: form.startDate || null,
            endDate: form.endDate || null,
            amount: form.amount || null,
            currency: form.currency,
            status: form.status,
            notes: form.notes,
            createdAt: new Date().toISOString(),
          },
          counterparty: cp
            ? {
                id: cp.id,
                name: cp.name,
                shortName: cp.shortName,
                type: cp.type,
                inn: cp.inn,
                ogrn: cp.ogrn,
                kpp: cp.kpp,
                legalAddress: cp.legalAddress,
                actualAddress: cp.actualAddress,
                bankName: cp.bankName,
                bankBik: cp.bankBik,
                bankAccount: cp.bankAccount,
                corrAccount: cp.corrAccount,
                phone: cp.phone,
                email: cp.email,
              }
            : null,
        }),
      });

      if (!response.ok) {
        throw new Error("Не удалось сформировать печатную форму");
      }

      const html = await response.text();
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        toast.error("Разрешите всплывающие окна для предпросмотра печати");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Ошибка при формировании печатной формы";
      toast.error(message);
    }
  }

  function handleSubmit() {
    if (!form.number.trim()) { toast.error("Укажите номер договора"); return; }
    if (!form.counterpartyId) { toast.error("Выберите контрагента"); return; }
    const data = {
      ...form,
      counterpartyId: parseInt(form.counterpartyId),
      startDate: form.startDate ? new Date(form.startDate) : undefined,
      endDate: form.endDate ? new Date(form.endDate) : undefined,
      amount: form.amount || undefined,
    };
    if (editId) {
      updateMutation.mutate({ id: editId, data });
    } else {
      createMutation.mutate(data);
    }
  }

  // Auto-fill counterparty when selected
  function handleCounterpartyChange(cpId: string) {
    const cp = counterparties?.find((c) => c.id === parseInt(cpId));
    setForm((p) => ({
      ...p,
      counterpartyId: cpId,
      // Auto-fill subject with counterparty name if empty
      subject: p.subject || (cp ? `Договор с ${cp.shortName ?? cp.name}` : p.subject),
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
            Договоры
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
            {Object.entries(CONTRACT_STATUSES).map(([k, v]) => (
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
            <BookOpen className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Договоры не найдены</p>
            <Button variant="outline" size="sm" onClick={openCreate} className="mt-4">Создать первый</Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Номер</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Контрагент</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Сумма</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Дата</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Статус</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((row) => {
                const contract = row.contract;
                const cp = row.counterparty;
                const statusInfo = CONTRACT_STATUSES[contract.status as keyof typeof CONTRACT_STATUSES];
                return (
                  <tr key={contract.id} className="hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-teal-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <BookOpen className="w-3.5 h-3.5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{contract.number}</p>
                          <p className="text-xs text-muted-foreground">
                            {CONTRACT_TYPES[contract.type as keyof typeof CONTRACT_TYPES] ?? contract.type}
                          </p>
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
                      <span className="text-xs text-muted-foreground">
                        {CONTRACT_TYPES[contract.type as keyof typeof CONTRACT_TYPES] ?? contract.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-sm text-foreground">{formatCurrency(contract.amount, contract.currency ?? "RUB")}</span>
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-xs text-muted-foreground">{formatDate(contract.createdAt)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="cursor-pointer">
                            <StatusBadge
                              label={statusInfo?.label ?? contract.status}
                              color={statusInfo?.color ?? "bg-slate-100 text-slate-600"}
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {Object.entries(CONTRACT_STATUSES).map(([k, v]) => (
                            <DropdownMenuItem
                              key={k}
                              onClick={() => updateStatusMutation.mutate({ id: contract.id, status: k as ContractStatus })}
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
                          <DropdownMenuItem onClick={() => openPrintForm(contract.id)}>
                            <Printer className="w-3.5 h-3.5 mr-2" /> Печатная форма
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => { if (confirm("Удалить договор?")) deleteMutation.mutate({ id: contract.id }); }}
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
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать договор" : "Новый договор"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Номер договора *</Label>
                <Input value={form.number} onChange={f("number")} placeholder="Д-2025/001" className="mt-1" />
              </div>
              <div>
                <Label>Тип</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as ContractType }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="framework">Рамочный</SelectItem>
                    <SelectItem value="one_time">Разовый</SelectItem>
                    <SelectItem value="service">Услуги</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Контрагент *</Label>
              <Select value={form.counterpartyId} onValueChange={handleCounterpartyChange}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Выберите контрагента" /></SelectTrigger>
                <SelectContent>
                  {counterparties?.map((cp) => (
                    <SelectItem key={cp.id} value={String(cp.id)}>
                      {cp.shortName ?? cp.name}
                      {cp.inn && <span className="text-muted-foreground ml-2 text-xs">{cp.inn}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Предмет договора</Label>
              <Input value={form.subject} onChange={f("subject")} placeholder="Поставка товаров..." className="mt-1" />
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Сумма</Label>
                <Input value={form.amount} onChange={f("amount")} placeholder="0.00" className="mt-1" type="number" />
              </div>
              <div>
                <Label>Статус</Label>
                <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v as ContractStatus }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CONTRACT_STATUSES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Примечания</Label>
              <Textarea value={form.notes} onChange={f("notes")} className="mt-1 resize-none" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => void openDraftPrintForm()}>
              <Printer className="w-4 h-4 mr-2" />
              Предпросмотр печати
            </Button>
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
