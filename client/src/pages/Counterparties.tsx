import { trpc } from "@/lib/trpc";
import { COUNTERPARTY_TYPES, formatDate, cn } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { Building2, Plus, Search, ChevronRight, Phone, Mail, MapPin, Pencil, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Link, useSearch } from "wouter";

type CPType = "legal" | "individual" | "sole_trader";

interface FormState {
  name: string;
  shortName: string;
  type: CPType;
  inn: string;
  ogrn: string;
  kpp: string;
  okpo: string;
  legalAddress: string;
  actualAddress: string;
  bankName: string;
  bankBik: string;
  bankAccount: string;
  corrAccount: string;
  phone: string;
  email: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  shortName: "",
  type: "legal",
  inn: "",
  ogrn: "",
  kpp: "",
  okpo: "",
  legalAddress: "",
  actualAddress: "",
  bankName: "",
  bankBik: "",
  bankAccount: "",
  corrAccount: "",
  phone: "",
  email: "",
  notes: "",
};

export default function Counterparties() {
  const searchStr = useSearch();
  const params = new URLSearchParams(searchStr);
  const shouldAutoOpenCreate = params.get("create") === "1";

  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [hasAutoOpenedCreate, setHasAutoOpenedCreate] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const utils = trpc.useUtils();

  const { data: list, isLoading } = trpc.counterparties.list.useQuery(
    { search: search || undefined },
    { placeholderData: (prev) => prev }
  );

  const createMutation = trpc.counterparties.create.useMutation({
    onSuccess: () => {
      utils.counterparties.list.invalidate();
      utils.dashboard.stats.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Контрагент добавлен");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.counterparties.update.useMutation({
    onSuccess: () => {
      utils.counterparties.list.invalidate();
      setDialogOpen(false);
      setEditId(null);
      toast.success("Контрагент обновлён");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.counterparties.delete.useMutation({
    onSuccess: () => {
      utils.counterparties.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Контрагент удалён");
    },
    onError: (e) => toast.error(e.message),
  });

  function openCreate() {
    setEditId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(cp: typeof list extends (infer T)[] | undefined ? T : never) {
    if (!cp) return;
    setEditId((cp as any).id);
    setForm({
      name: (cp as any).name ?? "",
      shortName: (cp as any).shortName ?? "",
      type: ((cp as any).type ?? "legal") as CPType,
      inn: (cp as any).inn ?? "",
      ogrn: (cp as any).ogrn ?? "",
      kpp: (cp as any).kpp ?? "",
      okpo: (cp as any).okpo ?? "",
      legalAddress: (cp as any).legalAddress ?? "",
      actualAddress: (cp as any).actualAddress ?? "",
      bankName: (cp as any).bankName ?? "",
      bankBik: (cp as any).bankBik ?? "",
      bankAccount: (cp as any).bankAccount ?? "",
      corrAccount: (cp as any).corrAccount ?? "",
      phone: (cp as any).phone ?? "",
      email: (cp as any).email ?? "",
      notes: (cp as any).notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Укажите наименование контрагента");
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, data: form });
    } else {
      createMutation.mutate(form);
    }
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
    setForm(emptyForm);
    setDialogOpen(true);
    setHasAutoOpenedCreate(true);
  }, [hasAutoOpenedCreate, shouldAutoOpenCreate]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            Контрагенты
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {list?.length ?? 0} записей в базе
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          Добавить
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Поиск по наименованию или ИНН..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground text-sm">Загрузка...</div>
        ) : !list?.length ? (
          <div className="p-12 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Контрагенты не найдены</p>
            <Button variant="outline" size="sm" onClick={openCreate} className="mt-4">
              Добавить первого
            </Button>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">Наименование</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden md:table-cell">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden lg:table-cell">ИНН</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Телефон</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Добавлен</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {list.map((cp) => (
                <tr key={cp.id} className="hover:bg-muted/20 transition-colors group">
                  <td className="px-4 py-3">
                    <Link href={`/counterparties/${cp.id}`} className="flex items-center gap-2 group/link">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground group-hover/link:text-primary transition-colors">
                            {cp.name}
                          </p>
                          {cp.shortName && (
                            <p className="text-xs text-muted-foreground">{cp.shortName}</p>
                          )}
                        </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground">
                      {COUNTERPARTY_TYPES[cp.type as keyof typeof COUNTERPARTY_TYPES] ?? cp.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-sm font-mono text-foreground">{cp.inn ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-sm text-muted-foreground">{cp.phone ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden xl:table-cell">
                    <span className="text-xs text-muted-foreground">{formatDate(cp.createdAt)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(cp)}
                        className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm("Удалить контрагента?")) deleteMutation.mutate({ id: cp.id });
                        }}
                        className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <Link href={`/counterparties/${cp.id}`} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                          <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Редактировать контрагента" : "Новый контрагент"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Полное наименование *</Label>
                <Input value={form.name} onChange={f("name")} placeholder="ООО Ромашка" className="mt-1" />
              </div>
              <div>
                <Label>Краткое наименование</Label>
                <Input value={form.shortName} onChange={f("shortName")} placeholder="Ромашка" className="mt-1" />
              </div>
              <div>
                <Label>Тип</Label>
                <Select value={form.type} onValueChange={(v) => setForm((p) => ({ ...p, type: v as CPType }))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="legal">ООО / АО / ПАО</SelectItem>
                    <SelectItem value="individual">Физическое лицо</SelectItem>
                    <SelectItem value="sole_trader">ИП</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Requisites */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Реквизиты</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <Label>ИНН</Label>
                  <Input value={form.inn} onChange={f("inn")} placeholder="7700000000" className="mt-1 font-mono" maxLength={12} />
                </div>
                <div>
                  <Label>ОГРН</Label>
                  <Input value={form.ogrn} onChange={f("ogrn")} placeholder="1027700000000" className="mt-1 font-mono" maxLength={15} />
                </div>
                <div>
                  <Label>КПП</Label>
                  <Input value={form.kpp} onChange={f("kpp")} placeholder="770001001" className="mt-1 font-mono" maxLength={9} />
                </div>
                <div>
                  <Label>ОКПО</Label>
                  <Input value={form.okpo} onChange={f("okpo")} placeholder="12345678" className="mt-1 font-mono" maxLength={10} />
                </div>
              </div>
            </div>

            {/* Addresses */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Адреса</p>
              <div className="space-y-3">
                <div>
                  <Label>Юридический адрес</Label>
                  <Input value={form.legalAddress} onChange={f("legalAddress")} placeholder="г. Москва, ул. Примерная, д. 1" className="mt-1" />
                </div>
                <div>
                  <Label>Фактический адрес</Label>
                  <Input value={form.actualAddress} onChange={f("actualAddress")} placeholder="г. Москва, ул. Примерная, д. 1" className="mt-1" />
                </div>
              </div>
            </div>

            {/* Bank */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Банковские реквизиты</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label>Наименование банка</Label>
                  <Input value={form.bankName} onChange={f("bankName")} placeholder="ПАО Сбербанк" className="mt-1" />
                </div>
                <div>
                  <Label>БИК</Label>
                  <Input value={form.bankBik} onChange={f("bankBik")} placeholder="044525225" className="mt-1 font-mono" maxLength={9} />
                </div>
                <div>
                  <Label>Расчётный счёт</Label>
                  <Input value={form.bankAccount} onChange={f("bankAccount")} placeholder="40702810000000000000" className="mt-1 font-mono" maxLength={20} />
                </div>
                <div>
                  <Label>Корр. счёт</Label>
                  <Input value={form.corrAccount} onChange={f("corrAccount")} placeholder="30101810400000000225" className="mt-1 font-mono" maxLength={20} />
                </div>
              </div>
            </div>

            {/* Contacts */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Контакты</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Телефон</Label>
                  <Input value={form.phone} onChange={f("phone")} placeholder="+7 (999) 000-00-00" className="mt-1" />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input value={form.email} onChange={f("email")} placeholder="info@company.ru" className="mt-1" type="email" />
                </div>
              </div>
            </div>

            <div>
              <Label>Примечания</Label>
              <Textarea value={form.notes} onChange={f("notes")} placeholder="Дополнительная информация..." className="mt-1 resize-none" rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editId ? "Сохранить" : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
