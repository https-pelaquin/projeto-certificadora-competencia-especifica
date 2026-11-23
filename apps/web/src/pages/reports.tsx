import './reports-print.css'

import {
  DEMO_ANALYTICS_DATA,
  calculateBudgetIndicators,
  calculatePurposeDistribution,
  summarizeRequestSituations,
} from "@/features/analytics"

const currency = (cents: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100)

const purposeLabels = {
  academic_events: "Eventos acadêmicos",
  equipment: "Equipamentos",
  research_materials: "Materiais de pesquisa",
  software_licenses: "Licenças de software",
  travel: "Viagens e diárias",
}

const situationLabels = {
  pending: "Pendentes",
  provisioned: "Provisionadas",
  utilized: "Utilizadas",
  closed: "Encerradas",
}

export default function ReportsDashboard() {
  const { budget, requests } = DEMO_ANALYTICS_DATA
  const indicators = calculateBudgetIndicators(budget)
  const purposes = calculatePurposeDistribution(requests)
  const situations = summarizeRequestSituations(requests)

  return (
    <div className="space-y-6 text-slate-900" id="relatorio-financeiro">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Prestação de contas</p>
          <p className="mt-1 text-sm font-semibold">Departamento de Computação — DACOM</p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-700"
        >
          Imprimir relatório
        </button>
      </div>
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-emerald-800">
            Relatório demonstrativo
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Execução orçamentária anual
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Exercício {budget.fiscalYear} · Dados de demonstração
          </p>
        </div>
        <p className="text-sm font-semibold text-slate-500">
          Atualizado em 20/09/2024
        </p>
      </div>

      <section
        className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Resumo financeiro anual"
      >
        {[
          {
            label: "Orçamento anual",
            value: indicators.annualTotal,
            detail: "100% do exercício",
          },
          {
            label: "Disponível",
            value: indicators.available,
            detail: `${indicators.availablePercentage.toFixed(1).replace(".", ",")}% do orçamento`,
          },
          {
            label: "Provisionado",
            value: indicators.provisioned,
            detail: `${indicators.provisionedPercentage.toFixed(1).replace(".", ",")}% do orçamento`,
          },
          {
            label: "Utilizado",
            value: indicators.utilized,
            detail: `${indicators.utilizedPercentage.toFixed(1).replace(".", ",")}% do orçamento`,
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-slate-500">
              {item.label}
            </h2>
            <p className="mt-3 text-xl font-bold tracking-tight">
              {currency(item.value)}
            </p>
            <p className="mt-2 text-xs text-slate-500">{item.detail}</p>
          </article>
        ))}
      </section>

      <div className="mt-7 grid items-start gap-7 xl:grid-cols-2">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold">
              Distribuição por finalidade
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Valores solicitados no exercício
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-6 py-3">Finalidade</th>
                  <th className="px-6 py-3 text-right">Pedidos</th>
                  <th className="px-6 py-3 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {purposes.map((item) => (
                  <tr key={item.purpose} className="border-t border-slate-200">
                    <td className="px-6 py-4 font-semibold">
                      {purposeLabels[item.purpose]}
                    </td>
                    <td className="px-6 py-4 text-right">{item.count}</td>
                    <td className="px-6 py-4 text-right font-semibold">
                      {currency(item.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-bold">Situação das solicitações</h2>
            <p className="mt-1 text-sm text-slate-500">
              Consolidação por estágio operacional
            </p>
          </div>
          <div className="divide-y divide-line">
            {situations.map((item) => (
              <article
                key={item.situation}
                className="flex items-center justify-between gap-4 px-6 py-4"
              >
                <div>
                  <h3 className="font-semibold">
                    {situationLabels[item.situation]}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {currency(item.requestedAmount)} solicitados
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  {item.count} pedido(s)
                </span>
              </article>
            ))}
          </div>
        </section>
      </div>

      <footer className="mt-8 border-t border-slate-200 pt-5 text-xs text-slate-500">
        Documento demonstrativo sem integração com API. As regras
        financeiras permanecem sujeitas à validação do backend.
      </footer>
    </div>
  )
}
