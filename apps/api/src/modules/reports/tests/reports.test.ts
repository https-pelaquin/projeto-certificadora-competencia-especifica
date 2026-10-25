import { afterAll, beforeEach, expect, it } from "vitest";
import { createApp } from "../../../app";
import { prisma } from "../../../shared/prisma";
import { resetDatabase } from "../../../test/db";
import { createRequest, createUser, loginAs } from "../../../test/factories";
import { closeBrowser } from "../reports.service";
import { annualReportHtml } from "../reports.template";
import { getAnnualSummary } from "../../budget/budget.service";

const app = createApp();
const year = new Date().getUTCFullYear();

beforeEach(resetDatabase);
afterAll(closeBrowser);

it("gera o PDF do ano e audita", async () => {
    const head = await createUser({ roles: ["HEAD"] });
    await createRequest({ requesterId: head.id, status: "PROVISIONED" });

    const res = await (await loginAs(app, head)).get(`/api/reports/annual/${year}.pdf`).buffer(true);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-disposition"]).toContain(`relatorio-anual-${year}.pdf`);
    expect(Buffer.from(res.body).subarray(0, 4).toString()).toBe("%PDF");
    expect(await prisma.auditLog.count({ where: { action: "REPORT_GENERATED" } })).toBe(1);
}, 60_000);

it("ano sem orçamento responde 404; professor recebe 403; ano inválido 400", async () => {
    const head = await createUser({ roles: ["HEAD"] });
    const agent = await loginAs(app, head);
    expect((await agent.get("/api/reports/annual/2099.pdf")).status).toBe(404);
    expect((await agent.get("/api/reports/annual/abc.pdf")).status).toBe(400);
    expect((await (await loginAs(app, await createUser())).get(`/api/reports/annual/${year}.pdf`)).status).toBe(403);
});

it("o HTML escapa texto informado pelo usuário", async () => {
    const prof = await createUser({ name: "<b>Prof</b>" });
    await createRequest({ requesterId: prof.id });
    const html = annualReportHtml(await getAnnualSummary(year), new Date());
    expect(html).toContain("&lt;b&gt;Prof&lt;/b&gt;");
    expect(html).toContain("Aguardando votação");
});
