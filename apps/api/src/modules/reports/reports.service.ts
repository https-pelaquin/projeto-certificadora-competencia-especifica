import { chromium, type Browser } from "playwright";
import type { Actor } from "../../shared/actor";
import { prisma } from "../../shared/prisma";
import * as audit from "../audit/audit.service";
import * as budgetService from "../budget/budget.service";
import { annualReportHtml } from "./reports.template";

const TIMEOUT_MS = 30_000;

// Um navegador reaproveitado; cada relatório usa um contexto novo e isolado.
let browser: Promise<Browser> | null = null;

function getBrowser() {
    browser ??= chromium.launch().catch((error) => {
        browser = null;
        throw error;
    });
    return browser;
}

export async function closeBrowser() {
    if (browser) {
        await (await browser).close();
        browser = null;
    }
}

export async function generateAnnualReport(actor: Actor, year: number, now = new Date()) {
    const summary = await budgetService.getAnnualSummary(year);
    const html = annualReportHtml(summary, now);

    const context = await (await getBrowser()).newContext({ javaScriptEnabled: false });
    try {
        const page = await context.newPage();
        page.setDefaultTimeout(TIMEOUT_MS);
        await page.setContent(html, { waitUntil: "load" });
        const pdf = await page.pdf({ format: "A4", printBackground: true, margin: { top: "15mm", bottom: "15mm", left: "12mm", right: "12mm" } });

        await audit.record(prisma, actor, { action: "REPORT_GENERATED", entityType: "AnnualReport", entityId: year });
        return pdf;
    } finally {
        await context.close();
    }
}
