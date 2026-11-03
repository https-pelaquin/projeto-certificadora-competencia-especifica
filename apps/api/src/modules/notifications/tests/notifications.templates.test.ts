import { describe, expect, it } from "vitest";
import { render } from "../notifications.templates";

const link = "http://app/solicitacoes/7";

describe("valores em reais", () => {
    it.each([
        ["1000.00", "R$ 1.000,00"],
        ["1500.5", "R$ 1.500,50"],
        ["12345678.99", "R$ 12.345.678,99"],
        ["0.10", "R$ 0,10"],
        ["999", "R$ 999,00"],
        ["100000.00", "R$ 100.000,00"],
    ])("%s vira %s", (amount, expected) => {
        const { text } = render({ template: "PAYMENT_RECORDED", data: { name: "Ana", requestId: 7, paidAmount: amount, link } });
        expect(text).toContain(`no valor de ${expected}.`);
    });
});

describe("modelos de solicitação", () => {
    it("aprovada: traz o número, a descrição e o valor provisionado", () => {
        const mail = render({ template: "REQUEST_PROVISIONED", data: { name: "Ana", requestId: 7, description: "Congresso", amount: "2500.00", link } });
        expect(mail.subject).toBe("Solicitação #7 aprovada");
        expect(mail.text).toContain('("Congresso") foi aprovada e o valor de R$ 2.500,00 foi provisionado');
        expect(mail.text).toContain(link);
    });

    it("cancelada: inclui a justificativa só quando existe", () => {
        const with_ = render({ template: "REQUEST_CANCELED", data: { name: "Ana", requestId: 7, justification: "Evento cancelado", link } });
        const without = render({ template: "REQUEST_CANCELED", data: { name: "Ana", requestId: 7, justification: null, link } });

        expect(with_.text).toContain("Justificativa: Evento cancelado");
        expect(without.text).not.toContain("Justificativa");
        expect(without.subject).toBe("Solicitação #7 cancelada");
    });

    it("complementação: leva a mensagem do chefe e convida a editar", () => {
        const mail = render({ template: "COMPLEMENT_REQUESTED", data: { name: "Ana", requestId: 7, message: "Anexe o convite", link } });
        expect(mail.subject).toBe("Informações pendentes: solicitação #7");
        expect(mail.text).toContain("Anexe o convite");
        expect(mail.text).toContain("Editar solicitação");
    });

    it("pagamento: assunto com o número da solicitação", () => {
        const mail = render({ template: "PAYMENT_RECORDED", data: { name: "Ana", requestId: 7, paidAmount: "700.00", link } });
        expect(mail.subject).toBe("Pagamento registrado: solicitação #7");
    });

    it("texto digitado por alguém não vira HTML", () => {
        const mail = render({
            template: "COMPLEMENT_REQUESTED",
            data: { name: "<b>Ana</b>", requestId: 7, message: '<script>alert("x")</script>', link },
        });
        expect(mail.html).not.toContain("<script>");
        expect(mail.html).not.toContain("<b>Ana</b>");
        expect(mail.html).toContain("&lt;script&gt;");
    });
});
