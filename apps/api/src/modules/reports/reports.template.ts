import type { RequestStatus } from "../../../generated/prisma/client";
import type * as budgetService from "../budget/budget.service";

type AnnualSummary = Awaited<ReturnType<typeof budgetService.getAnnualSummary>>;
type Money = { toString(): string };

const STATUS_LABELS: Record<RequestStatus, string> = {
    AWAITING_VOTING: "Aguardando votação",
    AWAITING_COMPLEMENT: "Aguardando complementação",
    AWAITING_BALANCE: "Aguardando saldo",
    IN_VOTING: "Em votação",
    PROVISIONED: "Provisionada",
    PAID: "Paga",
    REJECTED: "Rejeitada",
    CANCELED: "Cancelada",
};

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Decimal → string → Number só para formatar; nenhum cálculo é feito aqui.
function money(value: Money) {
    return Number(value.toString()).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function date(value: Date) {
    return value.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

// Template provisório até o cliente enviar o modelo oficial da UTFPR. [VALIDAR]
export function annualReportHtml(summary: AnnualSummary, generatedAt: Date) {
    const byStatus = new Map<RequestStatus, number>();
    for (const r of summary.requests) {
        byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
    }

    const rows = summary.requests.map((r) => `
        <tr>
            <td>${r.id}</td>
            <td>${date(r.createdAt)}</td>
            <td>${escapeHtml(r.requester.name)}</td>
            <td>${escapeHtml(r.category.name)}</td>
            <td>${escapeHtml(r.description)}</td>
            <td class="num">${money(r.amount)}</td>
            <td>${STATUS_LABELS[r.status]}</td>
            <td class="num">${r.payment ? money(r.payment.paidAmount) : "—"}</td>
        </tr>`).join("");

    const statusRows = [...byStatus].map(([status, count]) => `<tr><td>${STATUS_LABELS[status]}</td><td class="num">${count}</td></tr>`).join("");

    return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Relatório anual ${summary.year}</title>
<style>
    body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; }
    h1 { font-size: 16pt; margin: 0 0 4px; }
    h2 { font-size: 12pt; margin: 18px 0 6px; }
    .meta { color: #555; margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #bbb; padding: 4px 6px; text-align: left; vertical-align: top; }
    th { background: #eee; }
    .num { text-align: right; white-space: nowrap; }
    .summary td:first-child { width: 40%; }
</style>
</head>
<body>
    <h1>Relatório anual de recursos — DACOM — ${summary.year}</h1>
    <div class="meta">Gerado em ${generatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</div>

    <h2>Resumo financeiro</h2>
    <table class="summary">
        <tr><td>Orçamento inicial</td><td class="num">${money(summary.initialAmount)}</td></tr>
        <tr><td>Orçamento total (com ajustes)</td><td class="num">${money(summary.balance.total)}</td></tr>
        <tr><td>Utilizado</td><td class="num">${money(summary.balance.spent)}</td></tr>
        <tr><td>Provisionado</td><td class="num">${money(summary.balance.provisioned)}</td></tr>
        <tr><td>Disponível</td><td class="num">${money(summary.balance.available)}</td></tr>
    </table>

    <h2>Solicitações por situação</h2>
    <table>${statusRows || '<tr><td colspan="2">Nenhuma solicitação no ano.</td></tr>'}</table>

    <h2>Solicitações</h2>
    <table>
        <thead><tr><th>#</th><th>Data</th><th>Solicitante</th><th>Finalidade</th><th>Descrição</th><th>Valor</th><th>Situação</th><th>Pago</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="8">Nenhuma solicitação no ano.</td></tr>'}</tbody>
    </table>
</body>
</html>`;
}
