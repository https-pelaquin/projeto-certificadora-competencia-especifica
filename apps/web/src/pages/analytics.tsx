import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  fetchAnalyticsCategories,
  fetchAnalyticsRequests,
  fetchDashboard,
} from '@/features/analytics/dashboard-api'
import type { AnalyticsRequestStatus } from '@/features/analytics/dashboard-api'

const statusLabels: Record<AnalyticsRequestStatus, string> = {
  AWAITING_VOTING: 'Aguardando votação',
  AWAITING_COMPLEMENT: 'Aguardando complemento',
  AWAITING_BALANCE: 'Aguardando saldo',
  IN_VOTING: 'Em votação',
  PROVISIONED: 'Provisionada',
  PAID: 'Paga',
  REJECTED: 'Rejeitada',
  CANCELED: 'Cancelada',
}
const statusOptions = Object.entries(statusLabels) as Array<[
  AnalyticsRequestStatus,
  string,
]>
const moneyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})
// A conversão para number é apenas para exibição/desenho de gráficos.
// Regras e saldos monetários são calculados exclusivamente no backend.
const amountNumber = (value: string | number) => Number(value)
const currency = (value: string | number) => moneyFormatter.format(amountNumber(value))
const percent = (value: number) => `${value.toFixed(1).replace('.', ',')}%`
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm'
const chartColors = ['#0f766e', '#d69b39', '#4e88c7', '#8b5ec7', '#65b2a0']
const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, index) => currentYear - index)

type ChartRow = { label: string; amount: number; suffix?: string }

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
        <p className="mt-6 text-sm text-slate-500">Nenhum registro neste exercício.</p>
      ) : (
        <div className="mt-6 space-y-5">
          {rows.map((row, index) => (
            <div key={row.label}>
              <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{row.label}</span>
                <strong className="whitespace-nowrap">
                  {row.suffix ?? (valuesAreCurrency ? currency(row.amount) : String(row.amount))}
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
                    width: `${Math.max(0, (row.amount / max) * 100)}%`,
                    backgroundColor: chartColors[index % chartColors.length],
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
  total,
  available,
  provisioned,
  utilized,
}: {
  total: number
  available: number
  provisioned: number
  utilized: number
}) {
  const segments = [
    { label: 'Disponível', amount: available, color: chartColors[0] },
    { label: 'Provisionado', amount: provisioned, color: chartColors[1] },
    { label: 'Utilizado', amount: utilized, color: chartColors[2] },
  ]
  let cumulative = 0

  return (
    <section className={card}>
      <h2 className="text-lg font-bold">Composição do orçamento</h2>
      <p className="mt-1 text-xs text-slate-500">Distribuição do orçamento anual</p>
      <div className="mt-6 grid min-w-0 grid-cols-1 items-center gap-6 min-[580px]:grid-cols-[190px_minmax(0,1fr)]">
        <div
          className="relative mx-auto aspect-square w-48 max-w-full shrink-0"
          role="img"
          aria-label={segments.map((segment) => `${segment.label}: ${currency(segment.amount)}`).join('; ')}
        >
          <svg viewBox="0 0 220 220" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="110" cy="110" r="78" fill="none" stroke="#edf2f1" strokeWidth="26" />
            {segments.map((segment) => {
              const start = cumulative
              const length = total === 0 ? 0 : Math.max(0, (segment.amount / total) * 100)
              cumulative += length
              return (
                <circle
                  key={segment.label}
                  cx="110"
                  cy="110"
                  r="78"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="26"
                  strokeDasharray={`${length} ${Math.max(0, 100 - length)}`}
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
          {segments.map((segment) => (
            <li key={segment.label} className="min-w-0 rounded-lg bg-slate-50 px-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className="min-w-0 font-semibold text-sm text-slate-900">{segment.label}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 pl-5">
                <span className="text-xs text-slate-500">
                  {percent(total ? (segment.amount / total) * 100 : 0)} do orçamento
                </span>
                <strong className="whitespace-nowrap text-sm tabular-nums text-slate-900">
                  {currency(segment.amount)}
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
  const [year, setYear] = useState(currentYear)
  const [categoryId, setCategoryId] = useState('all')
  const [status, setStatus] = useState<'all' | AnalyticsRequestStatus>('all')
  const [page, setPage] = useState(1)

  const dashboardQuery = useQuery({
    queryKey: ['analytics', 'dashboard', year],
    queryFn: () => fetchDashboard(year),
    retry: false,
  })
  const categoriesQuery = useQuery({
    queryKey: ['analytics', 'categories'],
    queryFn: fetchAnalyticsCategories,
  })
  const requestsQuery = useQuery({
    queryKey: ['analytics', 'requests', year, page, categoryId, status],
    queryFn: () =>
      fetchAnalyticsRequests({
        year,
        page,
        categoryId: categoryId === 'all' ? undefined : Number(categoryId),
        status: status === 'all' ? undefined : status,
      }),
    enabled: dashboardQuery.isSuccess,
  })

  const data = dashboardQuery.data
  const balance = data?.balance
  const annualTotal = balance ? amountNumber(balance.total) : 0
  const available = balance ? amountNumber(balance.available) : 0
  const provisioned = balance ? amountNumber(balance.provisioned) : 0
  const utilized = balance ? amountNumber(balance.spent) : 0
  const budgetPercentage = (amount: number) => (annualTotal ? (amount / annualTotal) * 100 : 0)
  const metrics = [
    { label: 'Orçamento anual', value: annualTotal, detail: 'Total do exercício', color: chartColors[3] },
    { label: 'Disponível', value: available, detail: `${percent(budgetPercentage(available))} do total`, color: chartColors[0] },
    { label: 'Provisionado', value: provisioned, detail: `${percent(budgetPercentage(provisioned))} do total`, color: chartColors[1] },
    { label: 'Utilizado', value: utilized, detail: `${percent(budgetPercentage(utilized))} do total`, color: chartColors[2] },
  ]

  const pages = Math.ceil((requestsQuery.data?.total ?? 0) / 20)
  const requests = requestsQuery.data?.items ?? []

  return (
    <div id="conteudo" className="space-y-6 text-slate-900" data-testid="analytics-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="mb-1 text-sm font-semibold text-emerald-800">Painel analítico</p>
          <h1 className="text-3xl font-bold tracking-tight">Análise financeira</h1>
          <p className="mt-2 text-sm text-slate-500">Acompanhe a execução orçamentária e as solicitações</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800">
            Dados da API
          </span>
          <button
            type="button"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            onClick={() => {
              void dashboardQuery.refetch()
              void requestsQuery.refetch()
              void categoriesQuery.refetch()
            }}
          >
            Atualizar dados
          </button>
        </div>
      </div>

      <section className={card} aria-label="Filtros de análise">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <label className="text-sm font-semibold">
            Ano
            <select
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 font-normal focus-visible:outline-2 focus-visible:outline-emerald-700"
              value={year}
              onChange={(event) => {
                setYear(Number(event.target.value))
                setPage(1)
              }}
            >
              {yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Finalidade
            <select
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 font-normal focus-visible:outline-2 focus-visible:outline-emerald-700"
              value={categoryId}
              onChange={(event) => {
                setCategoryId(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Todas</option>
              {(categoriesQuery.data ?? []).map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Situação
            <select
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-3 font-normal focus-visible:outline-2 focus-visible:outline-emerald-700"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as 'all' | AnalyticsRequestStatus)
                setPage(1)
              }}
            >
              <option value="all">Todas</option>
              {statusOptions.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button
              className="w-full rounded-xl bg-[#164E3F] px-4 py-3 font-semibold text-white hover:bg-emerald-900 focus-visible:outline-2 focus-visible:outline-emerald-700"
              type="button"
              onClick={() => {
                setYear(currentYear)
                setCategoryId('all')
                setStatus('all')
                setPage(1)
              }}
            >
              Limpar filtros
            </button>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Ano altera todos os indicadores. Finalidade e situação filtram apenas a tabela de solicitações;
          os gráficos mostram os totais oficiais do ano retornados pela API.
        </p>
        {categoriesQuery.isError && (
          <p className="mt-2 text-xs text-amber-800" role="status">
            Não foi possível carregar as finalidades cadastradas. Tente atualizar os dados.
          </p>
        )}
      </section>

      {dashboardQuery.isPending ? (
        <section className={card} role="status">Carregando indicadores financeiros...</section>
      ) : dashboardQuery.isError ? (
        <section className={card} role="alert">
          <h2 className="text-xl font-bold">Não foi possível carregar o orçamento de {year}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {dashboardQuery.error instanceof Error ? dashboardQuery.error.message : 'Verifique a API e tente novamente.'}
          </p>
          <button className="mt-4 rounded-lg bg-[#164E3F] px-4 py-2 text-sm font-semibold text-white" onClick={() => void dashboardQuery.refetch()}>
            Tentar novamente
          </button>
        </section>
      ) : data ? (
        <>
          <section aria-label="Indicadores do orçamento" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <article key={metric.label} className={card}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-sm font-semibold text-slate-500">{metric.label}</h2>
                  <span className="size-3 rounded-full" style={{ backgroundColor: metric.color }} />
                </div>
                <p className="mt-3 break-words text-2xl font-bold tracking-tight">{currency(metric.value)}</p>
                <p className="mt-2 text-xs text-slate-500">{metric.detail}</p>
              </article>
            ))}
          </section>
          <div className="grid items-start gap-5 xl:grid-cols-2">
            <BudgetDonut total={annualTotal} available={available} provisioned={provisioned} utilized={utilized} />
            <HorizontalChart
              title="Pagamentos concluídos por mês"
              description="Valores realizados durante o exercício"
              rows={data.byMonth.map((month) => ({ label: month.month, amount: amountNumber(month.paid) }))}
            />
            <HorizontalChart
              title="Solicitações por finalidade"
              description="Principais finalidades do ano (até 5 categorias)"
              rows={data.topCategories.map((category) => ({ label: category.name, amount: amountNumber(category.amount) }))}
            />
            <HorizontalChart
              title="Situação das solicitações"
              description="Quantidade de pedidos por situação no ano"
              valuesAreCurrency={false}
              rows={data.requests.byStatus.map((item) => ({
                label: statusLabels[item.status] ?? item.status,
                amount: item.count,
                suffix: `${item.count} pedido(s)`,
              }))}
            />
          </div>
          <section className={card}>
            <h2 className="text-lg font-bold">Solicitações encontradas: {requestsQuery.data?.total ?? '...'}</h2>
            {requestsQuery.isPending ? (
              <p className="mt-3 text-sm text-slate-500">Carregando solicitações...</p>
            ) : requestsQuery.isError ? (
              <div role="alert" className="mt-3 text-sm text-rose-700">
                Não foi possível carregar a tabela. Verifique a conexão com a API.
                <button className="ml-3 underline" onClick={() => void requestsQuery.refetch()}>Tentar novamente</button>
              </div>
            ) : requests.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nenhuma solicitação encontrada para estes filtros.</p>
            ) : (
              <>
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
                      {requests.map((request) => (
                        <tr key={request.id} className="border-b border-slate-200">
                          <td className="p-3 font-semibold">#{request.id}</td>
                          <td className="p-3">{request.requester.name}</td>
                          <td className="p-3">{request.category.name}</td>
                          <td className="p-3">{statusLabels[request.status] ?? request.status}</td>
                          <td className="p-3 text-right">{currency(request.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pages > 1 && (
                  <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
                    <button
                      type="button"
                      disabled={page <= 1}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 disabled:opacity-40"
                      onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                    >
                      Anterior
                    </button>
                    <span>Página {page} de {pages}</span>
                    <button
                      type="button"
                      disabled={page >= pages}
                      className="rounded-lg border border-slate-200 bg-white px-4 py-2 disabled:opacity-40"
                      onClick={() => setPage((previous) => previous + 1)}
                    >
                      Próxima
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      ) : null}
      <p className="pb-5 text-xs text-slate-500">
        Os valores do orçamento são fornecidos pelo backend. Atualize os dados após
        registrar novas solicitações, provisionamentos ou pagamentos.
      </p>
    </div>
  )
}
