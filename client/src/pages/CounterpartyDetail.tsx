import { trpc } from "@/lib/trpc";
import { COUNTERPARTY_TYPES, CONTRACT_STATUSES, SPEC_STATUSES, WAYBILL_STATUSES, formatDate, formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Building2, BookOpen, ScrollText, Truck, Copy } from "lucide-react";
import { Link, useParams } from "wouter";
import { toast } from "sonner";

function ReqRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs text-muted-foreground w-36 flex-shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm text-foreground flex-1 ${mono ? "font-mono" : ""}`}>{value}</span>
      <button
        onClick={() => { navigator.clipboard.writeText(value); toast.success("Скопировано"); }}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-muted text-muted-foreground transition-all"
      >
        <Copy className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function CounterpartyDetail() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id ?? "0");

  const { data: cp, isLoading } = trpc.counterparties.getById.useQuery({ id });
  const { data: docs } = trpc.counterparties.getDocuments.useQuery({ id });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground text-sm">Загрузка...</div>
    );
  }

  if (!cp) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Контрагент не найден</p>
        <Link href="/counterparties" className="text-primary text-sm mt-2 inline-block">← Назад</Link>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Back */}
      <Link href="/counterparties" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Контрагенты
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
          <Building2 className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
            {cp.name}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {COUNTERPARTY_TYPES[cp.type as keyof typeof COUNTERPARTY_TYPES] ?? cp.type}
            {cp.inn && ` · ИНН ${cp.inn}`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Requisites card */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-card rounded-xl border border-border shadow-sm p-5 group">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Реквизиты</p>
            <ReqRow label="ИНН" value={cp.inn} mono />
            <ReqRow label="ОГРН" value={cp.ogrn} mono />
            <ReqRow label="КПП" value={cp.kpp} mono />
            <ReqRow label="ОКПО" value={cp.okpo} mono />
            <ReqRow label="Юридический адрес" value={cp.legalAddress} />
            <ReqRow label="Фактический адрес" value={cp.actualAddress} />
          </div>

          {(cp.bankName || cp.bankAccount) && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5 group">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Банковские реквизиты</p>
              <ReqRow label="Банк" value={cp.bankName} />
              <ReqRow label="БИК" value={cp.bankBik} mono />
              <ReqRow label="Расчётный счёт" value={cp.bankAccount} mono />
              <ReqRow label="Корр. счёт" value={cp.corrAccount} mono />
            </div>
          )}

          {(cp.phone || cp.email) && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5 group">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Контакты</p>
              <ReqRow label="Телефон" value={cp.phone} />
              <ReqRow label="Email" value={cp.email} />
            </div>
          )}

          {cp.notes && (
            <div className="bg-card rounded-xl border border-border shadow-sm p-5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Примечания</p>
              <p className="text-sm text-foreground">{cp.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar: linked documents */}
        <div className="space-y-4">
          {/* Contracts */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-teal-600" />
                <p className="text-xs font-semibold text-foreground">Договоры</p>
              </div>
              <span className="text-xs text-muted-foreground">{docs?.contracts.length ?? 0}</span>
            </div>
            {docs?.contracts.length ? (
              <div className="space-y-1.5">
                {docs.contracts.slice(0, 5).map((c) => (
                  <Link key={c.id} href={`/contracts?counterpartyId=${id}`} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted transition-colors group/item">
                      <div>
                        <p className="text-xs font-medium text-foreground">{c.number}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(c.createdAt)}</p>
                      </div>
                      <StatusBadge
                        {...(CONTRACT_STATUSES[c.status as keyof typeof CONTRACT_STATUSES] ?? { label: c.status, color: "bg-slate-100 text-slate-600" })}
                      />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Нет договоров</p>
            )}
            <Link href={`/contracts?create=1&counterpartyId=${id}`} className="mt-3 flex items-center gap-1 text-xs text-primary hover:underline">
                + Новый договор
            </Link>
          </div>

          {/* Specifications */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-amber-600" />
                <p className="text-xs font-semibold text-foreground">Спецификации</p>
              </div>
              <span className="text-xs text-muted-foreground">{docs?.specifications.length ?? 0}</span>
            </div>
            {docs?.specifications.length ? (
              <div className="space-y-1.5">
                {docs.specifications.slice(0, 5).map((s) => (
                  <Link key={s.id} href={`/specifications?counterpartyId=${id}`} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
                      <div>
                        <p className="text-xs font-medium text-foreground">{s.number}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(s.createdAt)}</p>
                      </div>
                      <StatusBadge
                        {...(SPEC_STATUSES[s.status as keyof typeof SPEC_STATUSES] ?? { label: s.status, color: "bg-slate-100 text-slate-600" })}
                      />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Нет спецификаций</p>
            )}
          </div>

          {/* Waybills */}
          <div className="bg-card rounded-xl border border-border shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-violet-600" />
                <p className="text-xs font-semibold text-foreground">Накладные</p>
              </div>
              <span className="text-xs text-muted-foreground">{docs?.waybills.length ?? 0}</span>
            </div>
            {docs?.waybills.length ? (
              <div className="space-y-1.5">
                {docs.waybills.slice(0, 5).map((w) => (
                  <Link key={w.id} href={`/waybills?counterpartyId=${id}`} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted transition-colors">
                      <div>
                        <p className="text-xs font-medium text-foreground">№ {w.number}</p>
                        <p className="text-[10px] text-muted-foreground">{formatDate(w.waybillDate)}</p>
                      </div>
                      <StatusBadge
                        {...(WAYBILL_STATUSES[w.status as keyof typeof WAYBILL_STATUSES] ?? { label: w.status, color: "bg-slate-100 text-slate-600" })}
                      />
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Нет накладных</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
