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
