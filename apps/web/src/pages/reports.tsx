import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import './reports-print.css'
import { fetchDashboard } from '@/features/analytics/dashboard-api'
import type { AnalyticsRequestStatus } from '@/features/analytics/dashboard-api'

const currency = (reais: string) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(reais))

const percent = (part: string, total: string) => {
  const totalNumber = Number(total)
  const value = totalNumber === 0 ? 0 : (Number(part) / totalNumber) * 100
  return `${value.toFixed(1).replace('.', ',')}%`
}

const statusLabels: Record<AnalyticsRequestStatus, string> = {
  AWAITING_VOTING: 'Aguardando votação',
  AWAITING_COMPLEMENT: 'Aguardando complementação',
  AWAITING_BALANCE: 'Aguardando saldo',
  IN_VOTING: 'Em votação',
  PROVISIONED: 'Provisionada',
  PAID: 'Paga',
  REJECTED: 'Rejeitada',
  CANCELED: 'Cancelada',
}

const currentYear = new Date().getFullYear()
const availableYears = Array.from({ length: 5 }, (_, index) => currentYear - index)

export default function ReportsDashboard() {
  const [year, setYear] = useState(currentYear)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const dashboardQuery = useQuery({
    queryKey: ['reports', 'dashboard', year],
    queryFn: () => fetchDashboard(year),
  })
  const dashboard = dashboardQuery.data
  const total = dashboard?.balance.total ?? '0.00'

  async function downloadOfficialPdf() {
    if (!dashboard || downloading) return
    setDownloadError(null)
    setDownloading(true)

    try {
      // Same-origin Vite proxy -> API real. O cookie de sessão é enviado junto.
      const response = await fetch(`/api/reports/annual/${year}.pdf`, {
        method: 'GET',
        credentials: 'include',
      })
      if (!response.ok) {
        const responseText = await response.text().catch(() => '')
        let message = `Não foi possível gerar o PDF (erro ${response.status}).`
        try {
          const errorData = JSON.parse(responseText) as {
            error?: { message?: string }
          }
          message = errorData.error?.message ?? message
        } catch {
          // Resposta sem JSON: mantém mensagem genérica.
        }
        throw new Error(message)
      }
      if (!response.headers.get('content-type')?.includes('application/pdf')) {
        throw new Error('A API não retornou um arquivo PDF válido.')
      }

      const pdfBlob = await response.blob()
      const downloadUrl = URL.createObjectURL(pdfBlob)
      const anchor = document.createElement('a')
      anchor.href = downloadUrl
      anchor.download = `relatorio-anual-${year}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 10_000)
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : 'Não foi possível baixar o relatório.',
      )
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6 text-slate-900" id="relatorio-financeiro">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Prestação de contas
          </p>
          <p className="mt-1 text-sm font-semibold">Departamento de Computação — DACOM</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Ano do relatório
            <select
              aria-label="Ano do relatório"
              value={year}
              onChange={(event) => {
                setYear(Number(event.target.value))
                setDownloadError(null)
              }}
              className="mt-1 block rounded-lg border border-slate-200 bg-white px-4 py-2 font-normal focus-visible:outline-2 focus-visible:outline-emerald-700"
            >
              {availableYears.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void downloadOfficialPdf()}
            disabled={!dashboard || dashboardQuery.isFetching || downloading}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloading ? 'Gerando PDF...' : 'Baixar PDF anual'}
          </button>
        </div>
      </div>

      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-800">Relatório financeiro — dados da API</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Execução orçamentária anual
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Exercício {year} · Dados fornecidos pelo backend
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500">
          {dashboardQuery.isFetching ? 'Atualizando dados...' : 'Consulta ao orçamento anual'}
        </p>
      </div>

      {downloadError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {downloadError}
          {downloadError.includes('erro 500') && (
            <span> Verifique também se o Chromium do Playwright está instalado no backend.</span>
          )}
        </p>
      )}

      {dashboardQuery.isLoading ? (
        <section role="status" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          Carregando informações do relatório...
        </section>
      ) : dashboardQuery.isError ? (
        <section role="alert" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold">Não foi possível carregar o relatório de {year}</h2>
          <p className="mt-2 text-sm text-slate-500">
            {dashboardQuery.error instanceof Error
              ? dashboardQuery.error.message
              : 'Verifique se existe um orçamento cadastrado para este exercício.'}
          </p>
          <button
            type="button"
            onClick={() => void dashboardQuery.refetch()}
            className="mt-4 rounded-lg bg-[#164E3F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0F382C] print:hidden"
          >
            Tentar novamente
          </button>
        </section>
      ) : dashboard ? (
        <>
          <section
            className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Resumo financeiro anual"
          >
            {[
              { label: 'Orçamento anual', value: dashboard.balance.total, detail: '100% do exercício' },
              { label: 'Disponível', value: dashboard.balance.available, detail: `${percent(dashboard.balance.available, total)} do orçamento` },
              { label: 'Provisionado', value: dashboard.balance.provisioned, detail: `${percent(dashboard.balance.provisioned, total)} do orçamento` },
              { label: 'Utilizado', value: dashboard.balance.spent, detail: `${percent(dashboard.balance.spent, total)} do orçamento` },
            ].map((item) => (
              <article key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-500">{item.label}</h2>
                <p className="mt-3 text-xl font-bold tracking-tight">{currency(item.value)}</p>
                <p className="mt-2 text-xs text-slate-500">{item.detail}</p>
              </article>
            ))}
          </section>

          <div className="mt-7 grid items-start gap-7 xl:grid-cols-2">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold">Principais categorias</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Até cinco categorias com maiores valores solicitados no exercício
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-6 py-3">Categoria</th>
                      <th className="px-6 py-3 text-right">Pedidos</th>
                      <th className="px-6 py-3 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.topCategories.length ? dashboard.topCategories.map((item) => (
                      <tr key={item.id} className="border-t border-slate-200">
                        <td className="px-6 py-4 font-semibold">{item.name}</td>
                        <td className="px-6 py-4 text-right">{item.count}</td>
                        <td className="px-6 py-4 text-right font-semibold">{currency(item.amount)}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={3} className="px-6 py-4 text-slate-500">Nenhuma solicitação neste exercício.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-6 py-5">
                <h2 className="text-lg font-bold">Situação das solicitações</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {dashboard.requests.total} solicitação(ões) no exercício
                </p>
              </div>
              <div className="divide-y divide-slate-100">
                {dashboard.requests.byStatus.length ? dashboard.requests.byStatus.map((item) => (
                  <article key={item.status} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <h3 className="font-semibold">{statusLabels[item.status] ?? item.status}</h3>
                      <p className="mt-1 text-xs text-slate-500">
                        {currency(item.amount)} solicitados
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                      {item.count} pedido(s)
                    </span>
                  </article>
                )) : (
                  <p className="px-6 py-4 text-sm text-slate-500">Nenhuma solicitação neste exercício.</p>
                )}
              </div>
            </section>
          </div>

          <footer className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-500">
            Prévia dos dados reais fornecidos pela API. O botão «Baixar PDF anual» gera o documento anual diretamente no backend, com o detalhamento de solicitações e pagamentos.
          </footer>
        </>
      ) : null}
    </div>
  )
}
