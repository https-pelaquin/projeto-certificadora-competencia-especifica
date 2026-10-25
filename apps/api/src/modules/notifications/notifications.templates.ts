// Templates de e-mail em pt-BR. Os dados ficam gravados na fila; o texto é montado no envio.
export type EmailMessage =
    | { template: "INVITE"; data: { name: string; link: string } }
    | { template: "PASSWORD_RESET"; data: { name: string; link: string } }
    | { template: "VOTING_OPENED"; data: { name: string; requestId: number; description: string; deadline: string; link: string } }
    | { template: "VOTING_TIE"; data: { name: string; requestId: number; link: string } }
    | { template: "VOTING_CLOSED"; data: { name: string; requestId: number; result: "APPROVED" | "REJECTED"; link: string } };

type Rendered = { subject: string; text: string; html: string };

function escapeHtml(value: string) {
    return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

function build(subject: string, greeting: string, paragraphs: string[], link: { label: string; url: string }): Rendered {
    const text = [greeting, ...paragraphs, `${link.label}: ${link.url}`].join("\n\n");
    const html = [
        `<p>${escapeHtml(greeting)}</p>`,
        ...paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`),
        `<p><a href="${escapeHtml(link.url)}">${escapeHtml(link.label)}</a></p>`,
    ].join("\n");
    return { subject, text, html };
}

export function render(message: EmailMessage): Rendered {
    switch (message.template) {
        case "INVITE": {
            const { name, link } = message.data;
            return build("Convite para a plataforma de recursos do DACOM", `Olá, ${name}.`, [
                "Você foi cadastrado na plataforma de gestão de recursos do DACOM.",
                "Defina sua senha pelo link abaixo. Ele vale por 7 dias e só pode ser usado uma vez.",
            ], { label: "Definir senha", url: link });
        }
        case "PASSWORD_RESET": {
            const { name, link } = message.data;
            return build("Redefinição de senha", `Olá, ${name}.`, [
                "Recebemos um pedido para redefinir sua senha. Se não foi você, ignore este e-mail.",
                "O link vale por 1 hora e só pode ser usado uma vez.",
            ], { label: "Redefinir senha", url: link });
        }
        case "VOTING_OPENED": {
            const { name, requestId, description, deadline, link } = message.data;
            return build(`Votação aberta: solicitação #${requestId}`, `Olá, ${name}.`, [
                `Você foi convocado para votar a solicitação #${requestId}: "${description}".`,
                `Prazo: ${formatDateTime(deadline)}.`,
            ], { label: "Abrir votação", url: link });
        }
        case "VOTING_TIE": {
            const { name, requestId, link } = message.data;
            return build(`Desempate necessário: solicitação #${requestId}`, `Olá, ${name}.`, [
                `A votação da solicitação #${requestId} terminou empatada e aguarda o seu voto de desempate.`,
            ], { label: "Desempatar", url: link });
        }
        case "VOTING_CLOSED": {
            const { name, requestId, result, link } = message.data;
            const outcome = result === "APPROVED" ? "aprovada" : "rejeitada";
            return build(`Solicitação #${requestId} ${outcome}`, `Olá, ${name}.`, [
                `A votação da solicitação #${requestId} foi encerrada: solicitação ${outcome}.`,
            ], { label: "Ver solicitação", url: link });
        }
    }
}
