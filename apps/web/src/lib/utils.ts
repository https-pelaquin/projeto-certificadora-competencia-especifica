import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes com suporte a condicionais */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor em reais (string decimal da API ou número) para moeda brasileira (R$).
 * @example formatCurrency("1500.00") => "R$ 1.500,00"
 * @example formatCurrency(1500) => "R$ 1.500,00"
 */
export function formatCurrency(value: number | string): string {
  const numeric = typeof value === 'string' ? Number(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number.isFinite(numeric) ? numeric : 0);
}

/**
 * Converte uma string monetária "1.500,00" para centavos.
 * @example parseCurrencyToCents("1.500,00") => 150000
 */
export function parseCurrencyToCents(value: string): number {
  const cleaned = value.replace(/\./g, '').replace(',', '.');
  return Math.round(parseFloat(cleaned) * 100);
}

/**
 * Formata uma data ISO 8601 para o padrão brasileiro.
 * @example formatDate("2024-03-15T10:00:00Z") => "15/03/2024"
 */
export function formatDate(isoDate: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(isoDate));
}

/**
 * Formata uma data ISO 8601 para formato completo com hora.
 */
export function formatDateTime(isoDate: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDate));
}

/**
 * Aplica máscara monetária a uma string de input.
 * Remove tudo que não é dígito, converte para formato "1.234,56".
 */
export function applyCurrencyMask(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, '');
  if (!digits) return '';

  const number = parseInt(digits, 10);
  const formatted = (number / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return formatted;
}
