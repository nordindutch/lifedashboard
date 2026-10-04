import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import type { BudgetExpenseRow, BudgetIncomeRow, BudgetInterestItem, BudgetSummary } from '../../../types';

/**
 * Pure rekenlogica voor de Budget-module. Geen React, geen netwerk.
 * De renteformules staan ook in backend/src/Modules/Budget/DebtMath.php; houd ze gelijk.
 */

export const MAX_PAYOFF_MONTHS = 600;

const euroFormatter = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

export function formatEuro(n: number): string {
  return euroFormatter.format(Math.abs(n) < 0.005 ? 0 : n);
}

/** Afgerond op hele euro's, voor lopende tekst ("ongeveer € 38"). */
export function formatEuroRounded(n: number): string {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Math.round(n));
}

export function formatPercent(pct: number, digits = 1): string {
  return `${pct.toLocaleString('nl-NL', { minimumFractionDigits: 0, maximumFractionDigits: digits })}%`;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---- maanden ----------------------------------------------------------------

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function isValidMonthKey(key: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(key)) {
    return false;
  }
  const m = Number(key.slice(5, 7));
  return m >= 1 && m <= 12;
}

export function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4));
  const m = Number(month.slice(5, 7));
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: string): string {
  const dt = new Date(`${month}-01T12:00:00`);
  const label = format(dt, 'MMMM yyyy', { locale: nl });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function shortMonthLabel(month: string): string {
  const dt = new Date(`${month}-01T12:00:00`);
  return format(dt, 'MMM', { locale: nl }).replace('.', '');
}

/** Maanden vóór de huidige maand zijn archief en alleen-lezen. */
export function isArchiveMonth(month: string, now: Date = new Date()): boolean {
  return month < currentMonthKey(now);
}

// ---- maandtotalen ------------------------------------------------------------

export interface MonthTotals {
  total_income: number;
  total_expenses: number;
  received: number;
  paid: number;
  pending_income: number;
  pending_expenses: number;
  projected_balance: number;
  total_interest: number;
}

/**
 * Zelfde rekenregels als BudgetController::buildPayload. Gebruikt voor optimistische updates,
 * zodat afvinken direct doorrekent zonder op de server te wachten.
 */
export function computeTotals(
  currentBalance: number,
  income: readonly BudgetIncomeRow[],
  expenses: readonly BudgetExpenseRow[],
  interestItems: readonly BudgetInterestItem[] = [],
): MonthTotals {
  let totalIncome = 0;
  let received = 0;
  let pendingIncome = 0;
  for (const row of income) {
    totalIncome += row.amount;
    if (row.received) {
      received += row.amount;
    } else {
      pendingIncome += row.amount;
    }
  }
  let totalExpenses = 0;
  let paid = 0;
  let pendingExpenses = 0;
  for (const row of expenses) {
    totalExpenses += row.amount;
    if (row.paid) {
      paid += row.amount;
    } else {
      pendingExpenses += row.amount;
    }
  }
  const totalInterest = round2(interestItems.reduce((s, i) => s + i.amount, 0));
  return {
    total_income: round2(totalIncome),
    total_expenses: round2(totalExpenses + totalInterest),
    received: round2(received),
    paid: round2(paid),
    pending_income: round2(pendingIncome),
    pending_expenses: round2(pendingExpenses + totalInterest),
    projected_balance: round2(currentBalance + pendingIncome - pendingExpenses - totalInterest),
    total_interest: totalInterest,
  };
}

/** Bouw een nieuwe summary met herberekende totalen, by_category uit de uitgaven. */
export function recomputeSummary(
  previous: BudgetSummary,
  currentBalance: number,
  income: readonly BudgetIncomeRow[],
  expenses: readonly BudgetExpenseRow[],
): BudgetSummary {
  const totals = computeTotals(currentBalance, income, expenses, previous.interest_items ?? []);
  const byCat = new Map<string, number>();
  for (const e of expenses) {
    byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount);
  }
  return {
    ...previous,
    ...totals,
    by_category: [...byCat.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([category, amount]) => ({ category: category as BudgetSummary['by_category'][number]['category'], amount: round2(amount) })),
  };
}

// ---- saldo-balk --------------------------------------------------------------

export interface BalanceBarModel {
  /** Vulling van de balk in procenten (projectie) */
  fillPct: number;
  /** Positie van de minimumstreep in procenten */
  minPct: number;
  belowMinimum: boolean;
  /** Afstand tot het minimum, altijd positief */
  distance: number;
}

/**
 * Schaal van de balk: minstens 2500, of hoger als saldo of projectie daarboven komt,
 * zodat het minimum nooit buiten beeld valt. Negatieve waarden klemmen op 0.
 */
export function balanceBarModel(currentBalance: number, projected: number, minimum: number): BalanceBarModel {
  const scale = Math.max(2500, projected, currentBalance, minimum * 1.25, 1);
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  return {
    fillPct: Math.round(clamp((projected / scale) * 100)),
    minPct: Math.round(clamp((minimum / scale) * 100)),
    belowMinimum: projected < minimum,
    distance: round2(Math.abs(projected - minimum)),
  };
}

// ---- schulden ----------------------------------------------------------------

/** Rente van één maand: saldo x percentage / 100 / 12. */
export function monthlyInterest(remaining: number, ratePct: number): number {
  if (remaining <= 0 || ratePct <= 0) {
    return 0;
  }
  return round2((remaining * ratePct) / 100 / 12);
}

export interface PayoffEstimate {
  /** null als de aflossing de rente niet dekt */
  months: number | null;
  totalInterest: number;
  paysOff: boolean;
}

/**
 * Looptijd en totale rente bij een vaste maandelijkse aflossing. Rente wordt per maand
 * bijgeschreven vóór de aflossing.
 */
export function payoffEstimate(remaining: number, ratePct: number, monthlyPayment: number): PayoffEstimate {
  if (remaining <= 0) {
    return { months: 0, totalInterest: 0, paysOff: true };
  }
  if (monthlyPayment <= 0) {
    return { months: null, totalInterest: 0, paysOff: false };
  }
  let balance = remaining;
  let totalInterest = 0;
  let months = 0;
  while (balance > 0.005 && months < MAX_PAYOFF_MONTHS) {
    const interest = (balance * ratePct) / 100 / 12;
    totalInterest += interest;
    balance = balance + interest - monthlyPayment;
    months++;
  }
  if (balance > 0.005) {
    return { months: null, totalInterest: round2(totalInterest), paysOff: false };
  }
  return { months, totalInterest: round2(totalInterest), paysOff: true };
}

export function debtProgressPct(amount: number, paidAmount: number): number {
  if (amount <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((paidAmount / amount) * 100)));
}

/** Snelknoppen voor aflossen: standaardbedragen plus "Alles" (openstaand saldo). */
export function paymentPresets(remaining: number, base: number[] = [50, 80, 160]): number[] {
  const out = base.filter((b) => b < remaining - 0.005);
  if (remaining > 0) {
    out.push(round2(remaining));
  }
  return out;
}

// ---- analyse -----------------------------------------------------------------

export interface CategoryBar {
  category: string;
  amount: number;
  /** Breedte in procenten ten opzichte van de grootste categorie */
  widthPct: number;
  /** Aandeel van het totaal in procenten */
  sharePct: number;
}

export function categoryBars(byCategory: readonly { category: string; amount: number }[]): CategoryBar[] {
  const rows = byCategory.filter((c) => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const max = rows[0]?.amount ?? 0;
  const total = rows.reduce((s, r) => s + r.amount, 0);
  return rows.map((r) => ({
    category: r.category,
    amount: round2(r.amount),
    widthPct: max > 0 ? Math.max(2, Math.round((r.amount / max) * 100)) : 0,
    sharePct: total > 0 ? Math.round((r.amount / total) * 100) : 0,
  }));
}

export function runwayLabel(months: number | null): string {
  if (months === null) {
    return 'Onbekend';
  }
  if (months >= 120) {
    return '10+ jaar';
  }
  return `${months.toLocaleString('nl-NL', { maximumFractionDigits: 1 })} mnd`;
}

/** Sorteer open posten: grootste bedrag eerst, daarna op naam. */
export function sortOpenFirstLargest<T extends { amount: number; name: string }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, 'nl'));
}
