import { describe, expect, it } from "vitest";
import { dateBrasilia, startOfDayBrasilia } from "./dates";

describe("dateBrasilia (ano de negócio)", () => {
    it.each([
        ["2026-12-31T23:00:00Z", 2026],
        ["2027-01-01T02:59:59Z", 2026], // ainda 31/12 em Brasília (UTC−3)
        ["2027-01-01T03:00:00Z", 2027], // virou o ano em Brasília
        ["2027-06-15T12:00:00Z", 2027],
    ])("%s → %i", (iso, year) => {
        expect(dateBrasilia(new Date(iso))).toBe(year);
    });
});

describe("startOfDayBrasilia", () => {
    it.each([
        ["2026-11-25T15:00:00Z", "2026-11-25T03:00:00.000Z"],
        ["2026-11-25T03:00:00Z", "2026-11-25T03:00:00.000Z"], // exatamente a meia-noite de Brasília
        ["2026-11-25T02:59:59Z", "2026-11-24T03:00:00.000Z"], // ainda é o dia 24 em Brasília
        ["2027-01-01T01:00:00Z", "2026-12-31T03:00:00.000Z"], // atravessa a virada de ano
    ])("%s → %s", (iso, expected) => {
        expect(startOfDayBrasilia(new Date(iso)).toISOString()).toBe(expected);
    });
});
