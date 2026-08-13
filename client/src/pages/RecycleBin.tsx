import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { ArchiveRestore, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

const entityLabels = {
  counterparty: "Контрагент",
  contract: "Договор",
  deal: "Сделка",
  specification: "Спецификация",
  waybill: "ТТН",
  attachment: "Файл",
} as const;

export default function RecycleBin() {
  const utils = trpc.useUtils();
  const { data: records = [], isLoading } = trpc.recycleBin.list.useQuery();
  const restoreMutation = trpc.recycleBin.restore.useMutation({
    onSuccess: () => {
      utils.recycleBin.list.invalidate();
      utils.counterparties.list.invalidate();
      utils.contracts.list.invalidate();
      utils.specifications.list.invalidate();
      utils.waybills.list.invalidate();
      utils.dashboard.stats.invalidate();
      toast.success("Запись восстановлена");
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto max-w-4xl p-6 lg:p-8">
      <div className="mb-6 flex items-start gap-3">
        <div className="rounded-lg bg-amber-100 p-2 text-amber-700"><Trash2 className="h-5 w-5" /></div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Корзина</h1>
          <p className="mt-1 text-sm text-muted-foreground">Удалённые записи остаются здесь и могут быть восстановлены.</p>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {isLoading ? <p className="p-8 text-center text-sm text-muted-foreground">Загрузка…</p> : records.length === 0 ? (
          <div className="p-12 text-center">
            <ArchiveRestore className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Корзина пуста</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {records.map((record) => (
              <li key={`${record.entityType}-${record.id}`} className="flex items-center gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{record.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {entityLabels[record.entityType]} · удалено {new Date(record.deletedAt).toLocaleString("ru-RU")}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={restoreMutation.isPending}
                  onClick={() => restoreMutation.mutate({ entityType: record.entityType, id: record.id })}
                >
                  <RotateCcw className="h-4 w-4" />
                  Восстановить
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
