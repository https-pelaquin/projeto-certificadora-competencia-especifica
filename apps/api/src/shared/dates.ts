// Mantém o dia quando possível; em meses mais curtos usa o último dia (31/03 − 1 mês = 28/02).
export function addMonths(date: Date, months: number): Date {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + months;
    const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const day = Math.min(date.getUTCDate(), lastDayOfMonth);

    return new Date(Date.UTC(
        year, month, day,
        date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds(), date.getUTCMilliseconds(),
    ));
}

export function dateBrasilia(date: Date):number{
    const formatedDate =  Intl.DateTimeFormat('pt-BR', {year:'numeric', timeZone:"America/Sao_Paulo"}).format(date);
    return Number(formatedDate);
}

// Brasília está fixa em UTC−3 (sem horário de verão desde 2019).
const BRASILIA_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

// Instante em que começou o dia de `date` em Brasília (ex.: 25/11 15:00Z → 25/11 03:00Z).
export function startOfDayBrasilia(date: Date): Date {
    const brasiliaClock = date.getTime() - BRASILIA_OFFSET_MS;
    return new Date(Math.floor(brasiliaClock / DAY_MS) * DAY_MS + BRASILIA_OFFSET_MS);
}
