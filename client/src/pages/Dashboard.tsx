import { trpc } from "@/lib/trpc";
import { BookOpen, Building2, ScrollText, Truck, TrendingUp, ArrowRight } from "lucide-react";
import { Link } from "wouter";

const statCards = [
  {
    label: "Контрагенты",
    key: "counterparties" as const,
    icon: Building2,
    href: "/counterparties",
    color: "from-blue-50 to-indigo-50",
    iconColor: "text-indigo-600",
    iconBg: "bg-indigo-100",
  },
  {
    label: "Договоры",
    key: "contracts" as const,
    icon: BookOpen,
    href: "/contracts",
    color: "from-emerald-50 to-teal-50",
    iconColor: "text-teal-600",
    iconBg: "bg-teal-100",
  },
  {
    label: "Спецификации",
    key: "specifications" as const,
    icon: ScrollText,
    href: "/specifications",
    color: "from-amber-50 to-orange-50",
    iconColor: "text-amber-600",
    iconBg: "bg-amber-100",
  },
  {
    label: "Накладные",
    key: "waybills" as const,
    icon: Truck,
    href: "/waybills",
    color: "from-purple-50 to-violet-50",
    iconColor: "text-violet-600",
    iconBg: "bg-violet-100",
  },
];

export default function Dashboard() {
  const { data: stats, isLoading } = trpc.dashboard.stats.useQuery();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-semibold text-foreground mb-1"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Обзор системы
        </h1>
        <p className="text-sm text-muted-foreground">
          Управление документооборотом грузоперевозок
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {statCards.map((card) => {
          const Icon = card.icon;
          const count = stats?.[card.key] ?? 0;
          return (
            <Link key={card.key} href={card.href} className="block group">
                <div
                  className={`relative bg-gradient-to-br ${card.color} rounded-xl p-5 border border-white/80 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 ${card.iconBg} rounded-lg flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${card.iconColor}`} />
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                  </div>
                  <div>
                    {isLoading ? (
                      <div className="h-8 w-12 bg-white/60 rounded animate-pulse mb-1" />
                    ) : (
                      <p className="text-3xl font-bold text-foreground mb-0.5">{count}</p>
                    )}
                    <p className="text-sm text-muted-foreground font-medium">{card.label}</p>
                  </div>
                </div>
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Быстрые действия</h2>
          </div>
          <div className="space-y-2">
            {[
              { href: "/counterparties?create=1", label: "Добавить контрагента", icon: Building2 },
              { href: "/contracts?create=1", label: "Создать договор", icon: BookOpen },
              { href: "/specifications?create=1", label: "Новая спецификация", icon: ScrollText },
              { href: "/waybills?create=1", label: "Оформить накладную", icon: Truck },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} href={action.href} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted transition-colors group">
                    <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm text-foreground">{action.label}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40 ml-auto group-hover:text-primary/60 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Справочник разделов</h2>
          </div>
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex gap-3">
              <Building2 className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">Контрагенты</span> — база компаний и ИП с реквизитами (ИНН, ОГРН, КПП, банковские счета)
              </div>
            </div>
            <div className="flex gap-3">
              <BookOpen className="w-4 h-4 text-teal-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">Договоры</span> — рамочные и разовые договоры, привязанные к контрагентам
              </div>
            </div>
            <div className="flex gap-3">
              <ScrollText className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">Спецификации</span> — условия поставки с учётом объёмов (отгружено / остаток)
              </div>
            </div>
            <div className="flex gap-3">
              <Truck className="w-4 h-4 text-violet-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium text-foreground">Накладные</span> — транспортные документы с генерацией PDF
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
