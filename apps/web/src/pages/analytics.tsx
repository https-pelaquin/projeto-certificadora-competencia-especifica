import { useMemo, useState } from "react"
import {
  DEMO_ANALYTICS_DATA,
  calculateBudgetIndicators,
  calculatePurposeDistribution,
  sumCompletedPaymentsByMonth,
  summarizeRequestSituations,
} from "@/features/analytics"
import type { RequestPurpose, RequestStatus } from "@/features/analytics"

const data = DEMO_ANALYTICS_DATA
const purposes: Record<RequestPurpose, string> = {
  academic_events: "Eventos acadêmicos",
  equipment: "Equipamentos",
  research_materials: "Materiais de pesquisa",
  software_licenses: "Licenças de software",
  travel: "Viagens e diárias",
}
const statuses: Record<RequestStatus, string> = {
  draft: "Rascunho",
  submitted: "Enviada",
  under_review: "Em análise",
  approved: "Aprovada",
  provisioned: "Provisionada",
  partially_paid: "Pagamento parcial",
  paid: "Paga",
  rejected: "Rejeitada",
  cancelled: "Cancelada",
}
const situations: Record<string, string> = {
  pending: "Pendentes",
  provisioned: "Provisionadas",
  utilized: "Utilizadas",
  closed: "Encerradas",
}
const currency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  )
const percent = (value: number) => `${value.toFixed(1).replace(".", ",")}%`
const card = "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
const chartColors = ["#0f766e", "#d69b39", "#4e88c7", "#8b5ec7", "#65b2a0"]

type ChartRow = {
  label: string
  amount: number
  suffix?: string
}

function HorizontalChart({
  title,
  description,
  rows,
  valuesAreCurrency = true,
}: {
  title: string
  description?: string
  rows: ChartRow[]
  valuesAreCurrency?: boolean
}) {
  const max = Math.max(1, ...rows.map((row) => row.amount))
  return (
    <section className={card} aria-label={title}>
      <h2 className="text-lg font-bold">{title}</h2>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">
          Nenhum registro para os filtros selecionados.
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          {rows.map((row, i) => (
            <div key={row.label}>
              <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{row.label}</span>
                <strong className="whitespace-nowrap">
                  {row.suffix ??
                    (valuesAreCurrency
                      ? currency(row.amount)
                      : String(row.amount))}
                </strong>
              </div>
              <div
                className="h-3.5 overflow-hidden rounded-full bg-[#eaf0ef]"
                role="img"
                aria-label={`${row.label}: ${row.suffix ?? (valuesAreCurrency ? currency(row.amount) : row.amount)}`}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(row.amount / max) * 100}%`,
                    backgroundColor: chartColors[i % chartColors.length],
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function BudgetDonut({
  available,
  provisioned,
  utilized,
}: {
  available: number
  provisioned: number
  utilized: number
}) {
  const segments = [
    { label: "Disponível", amount: available, color: chartColors[0] },
    { label: "Provisionado", amount: provisioned, color: chartColors[1] },
    { label: "Utilizado", amount: utilized, color: chartColors[2] },
  ]
  const total = available + provisioned + utilized
  let cumulative = 0

  return (
    <section className={card}>
      <h2 className="text-lg font-bold">Composição do orçamento</h2>
      <p className="mt-1 text-xs text-slate-500">Distribuição do orçamento anual</p>

      <div className="mt-6 grid min-w-0 grid-cols-1 items-center gap-6 min-[580px]:grid-cols-[190px_minmax(0,1fr)]">
        <div
          className="relative mx-auto aspect-square w-48 max-w-full shrink-0"
          role="img"
          aria-label={segments
            .map((s) => `${s.label}: ${currency(s.amount)}`)
            .join("; ")}
        >
          <svg
            viewBox="0 0 220 220"
            className="h-full w-full -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="110"
              cy="110"
              r="78"
              fill="none"
              stroke="#edf2f1"
              strokeWidth="26"
            />
            {segments.map((s) => {
              const start = cumulative
              const length = total === 0 ? 0 : (s.amount / total) * 100
              cumulative += length
              return (
                <circle
                  key={s.label}
                  cx="110"
                  cy="110"
                  r="78"
                  fill="none"
                  stroke={s.color}
                  strokeWidth="26"
                  strokeDasharray={`${length} ${100 - length}`}
                  strokeDashoffset={-start}
                  pathLength="100"
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
            <span className="text-[11px] text-slate-500">Orçamento total</span>
            <strong className="mt-1 whitespace-nowrap text-[16px] font-bold tracking-tight text-slate-900">
              {currency(total)}
            </strong>
          </div>
        </div>

        <ul className="min-w-0 space-y-3">
          {segments.map((s) => (
            <li
              key={s.label}
              className="min-w-0 rounded-lg bg-slate-50 px-3 py-2"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ backgroundColor: s.color }}
                />
                <span className="min-w-0 font-semibold text-sm text-slate-900">
                  {s.label}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pl-5">
                <span className="text-xs text-slate-500">
                  {percent(total ? (s.amount / total) * 100 : 0)} do orçamento
                </span>
                <strong className="whitespace-nowrap text-sm tabular-nums text-slate-900">
                  {currency(s.amount)}
                </strong>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function AnalyticsDashboard() {
  const [year, setYear] = useState(String(data.budget.fiscalYear))
  const [purpose, setPurpose] = useState("all")
  const [status, setStatus] = useState("all")
  const activeYear = Number(year) === data.budget.fiscalYear
  const filteredRequests = useMemo(
    () =>
      activeYear
        ? data.requests.filter(
            (r) =>
              (purpose === "all" || r.purpose === purpose) &&
              (status === "all" || r.status === status),
          )
        : [],
    [activeYear, purpose, status],
  )
  const indicators = calculateBudgetIndicators(data.budget)
  const distribution = calculatePurposeDistribution(filteredRequests)
  const summary = summarizeRequestSituations(filteredRequests)
  const monthly = activeYear ? sumCompletedPaymentsByMonth(data.payments) : []
  const metrics = [
    {
      label: "Orçamento anual",
      value: indicators.annualTotal,
      detail: "Total do exercício",
      color: chartColors[3],
    },
    {
      label: "Disponível",
      value: indicators.available,
      detail: `${percent(indicators.availablePercentage)} do total`,
      color: chartColors[0],
    },
    {
      label: "Provisionado",
      value: indicators.provisioned,
      detail: `${percent(indicators.provisionedPercentage)} do total`,
      color: chartColors[1],
    },
    {
      label: "Utilizado",
      value: indicators.utilized,
      detail: `${percent(indicators.utilizedPercentage)} do total`,
      color: chartColors[2],
    },
  ]
  return (
    <div id="conteudo" className="space-y-6 text-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-sm font-semibold text-emerald-800">
            Painel analítico
          </p>
          <h1 className="text-3xl font-bold tracking-tight">
            Análise financeira
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Acompanhe a execução orçamentária e as solicitações
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-4 py-2 text-xs font-bold text-amber-800">
          Dados de demonstração
        </span>
      </div>
      <section className={card} aria-label="Filtros de análise">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold">
            Ano
            <select
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 font-normal focus-visible:outline-2 focus-visible:outline-emerald-700"
              value={year}
              onChange={(e) => setYear(e.target.value)}
            >
              <option value="2024">2024</option>
              <option value="2025">2025 (sem dados)</option>
              <option value="2026">2026 (sem dados)</option>
            </select>
          </label>
          <label className="text-sm font-semibold">
            Finalidade
            <select
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 font-normal focus-visible:outline-2 focus-visible:outline-emerald-700"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            >
              <option value="all">Todas</option>
              {Object.entries(purposes).map(([key, name]) => (
                <option value={key} key={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Situação
            <select
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 font-normal focus-visible:outline-2 focus-visible:outline-emerald-700"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="all">Todas</option>
              {Object.entries(statuses).map(([key, name]) => (
                <option value={key} key={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <button
              className="w-full rounded-xl bg-[#164E3F] px-4 py-3 font-semibold text-white hover:bg-[#164E3F]-strong focus-visible:outline-2 focus-visible:outline-emerald-700"
              type="button"
              onClick={() => {
                setYear(String(data.budget.fiscalYear))
                setPurpose("all")
                setStatus("all")
              }}
            >
              Limpar filtros
            </button>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Finalidade e situação filtram solicitações; não alteram os saldos
          globais do orçamento.
        </p>
      </section>
      {!activeYear ? (
        <section className={card} role="status">
          <h2 className="text-xl font-bold">Sem dados para {year}</h2>
          <p className="mt-2 text-sm text-slate-500">
            Os dados de demonstração existem apenas para 2024. Escolha 2024
            para visualizar o painel.
          </p>
        </section>
      ) : (
        <>
          <section
            aria-label="Indicadores do orçamento"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {metrics.map((m) => (
              <article key={m.label} className={card}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-500">
                    {m.label}
                  </h2>
                  <span
                    className="size-3 rounded-full"
                    style={{ backgroundColor: m.color }}
                  />
                </div>
                <p className="mt-3 break-words text-2xl font-bold tracking-tight">
                  {currency(m.value)}
                </p>
                <p className="mt-2 text-xs text-slate-500">{m.detail}</p>
              </article>
            ))}
          </section>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <BudgetDonut
              available={indicators.available}
              provisioned={indicators.provisioned}
              utilized={indicators.utilized}
            />
            <HorizontalChart
              title="Pagamentos concluídos por mês"
              description="Valores realizados durante o exercício"
              rows={monthly.map((m) => ({
                label: m.month,
                amount: m.amount,
              }))}
            />
            <HorizontalChart
              title="Solicitações por finalidade"
              description="Soma dos valores solicitados conforme os filtros"
              rows={distribution.map((d) => ({
                label: purposes[d.purpose],
                amount: d.amount,
              }))}
            />
            <HorizontalChart
              title="Situação das solicitações"
              description="Quantidade de pedidos por grupo de situação"
              valuesAreCurrency={false}
              rows={summary.map((s) => ({
                label: situations[s.situation],
                amount: s.count,
                suffix: `${s.count} pedido(s)`,
              }))}
            />
          </div>
          <section className={card}>
            <h2 className="text-lg font-bold">
              Solicitações encontradas: {filteredRequests.length}
            </h2>
            {filteredRequests.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">
                Nenhuma solicitação encontrada para estes filtros.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[650px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="p-3">Pedido</th>
                      <th className="p-3">Solicitante</th>
                      <th className="p-3">Finalidade</th>
                      <th className="p-3">Situação</th>
                      <th className="p-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.map((r) => (
                      <tr key={r.id} className="border-b border-slate-200">
                        <td className="p-3 font-semibold">{r.id}</td>
                        <td className="p-3">{r.requesterName}</td>
                        <td className="p-3">{purposes[r.purpose]}</td>
                        <td className="p-3">{statuses[r.status]}</td>
                        <td className="p-3 text-right">
                          {currency(r.requestedAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <p className="pb-5 text-xs text-slate-500">
        Painel demonstrativo, sem integração com API. Pagamentos feitos em
        outras telas ainda não atualizam estes indicadores.
      </p>
    </div>
  )
}
