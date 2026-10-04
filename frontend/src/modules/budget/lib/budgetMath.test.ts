import { describe, expect, it } from 'vitest';
import type { BudgetExpenseRow, BudgetIncomeRow, BudgetSummary } from '../../../types';
import {
  balanceBarModel,
  categoryBars,
  computeTotals,
  currentMonthKey,
  isArchiveMonth,
  isValidMonthKey,
  monthLabel,
  monthlyInterest,
  paymentPresets,
  payoffEstimate,
  recomputeSummary,
  shiftMonth,
  sortOpenFirstLargest,
} from './budgetMath';

const income = (id: number, amount: number, received: boolean): BudgetIncomeRow => ({
  id, month_id: 1, name: `i${id}`, amount, received, sort_order: id,
});
const expense = (id: number, amount: number, paid: boolean, category: BudgetExpenseRow['category'] = 'Vaste Last'): BudgetExpenseRow => ({
  id, month_id: 1, name: `e${id}`, amount, paid, category, sort_order: id,
});

describe('maanden', () => {
  it('maakt en verschuift maandsleutels', () => {
    expect(currentMonthKey(new Date(2026, 9, 4))).toBe('2026-10');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(isValidMonthKey('2026-10')).toBe(true);
    expect(isValidMonthKey('2026-13')).toBe(false);
    expect(isValidMonthKey('2026-1')).toBe(false);
  });

  it('markeert eerdere maanden als archief', () => {
    const now = new Date(2026, 9, 4);
    expect(isArchiveMonth('2026-09', now)).toBe(true);
    expect(isArchiveMonth('2026-10', now)).toBe(false);
    expect(isArchiveMonth('2026-11', now)).toBe(false);
  });

  it('toont de maandnaam met hoofdletter', () => {
    expect(monthLabel('2026-10')).toBe('Oktober 2026');
  });
});

describe('projectie', () => {
  it('rekent saldo plus te ontvangen min te betalen', () => {
    const t = computeTotals(1842.5, [income(1, 450, false), income(2, 1610, true)], [expense(1, 725, false), expense(2, 96, true)]);
    expect(t.total_income).toBe(2060);
    expect(t.pending_income).toBe(450);
    expect(t.pending_expenses).toBe(725);
    expect(t.total_expenses).toBe(821);
    expect(t.projected_balance).toBe(1567.5);
  });

  it('telt rente van schulden mee als te betalen', () => {
    const t = computeTotals(1000, [], [expense(1, 100, false)], [{ debt_id: 1, name: 'CC', amount: 7.95 }]);
    expect(t.total_interest).toBe(7.95);
    expect(t.pending_expenses).toBe(107.95);
    expect(t.projected_balance).toBe(892.05);
  });

  it('rekent direct door bij afvinken (optimistische update)', () => {
    const summary: BudgetSummary = {
      total_income: 0, total_expenses: 0, received: 0, paid: 0, pending_income: 0, pending_expenses: 0,
      projected_balance: 0, by_category: [], interest_items: [], total_interest: 0,
    };
    const before = recomputeSummary(summary, 500, [], [expense(1, 200, false), expense(2, 50, false, 'Abonnement')]);
    expect(before.projected_balance).toBe(250);
    const after = recomputeSummary(summary, 500, [], [expense(1, 200, true), expense(2, 50, false, 'Abonnement')]);
    expect(after.projected_balance).toBe(450);
    expect(after.paid).toBe(200);
    expect(after.by_category).toEqual([
      { category: 'Abonnement', amount: 50 },
      { category: 'Vaste Last', amount: 200 },
    ]);
  });
});

describe('saldobalk', () => {
  it('zet de minimumstreep en vulling op schaal', () => {
    const m = balanceBarModel(1842.5, 1126.3, 500);
    expect(m.belowMinimum).toBe(false);
    expect(m.distance).toBe(626.3);
    expect(m.minPct).toBe(20);
    expect(m.fillPct).toBe(45);
  });

  it('waarschuwt onder het minimum en klemt negatieve waarden', () => {
    const m = balanceBarModel(100, -200, 500);
    expect(m.belowMinimum).toBe(true);
    expect(m.fillPct).toBe(0);
    expect(m.distance).toBe(700);
  });

  it('houdt het minimum in beeld bij grote minimums', () => {
    const m = balanceBarModel(100, 100, 4000);
    expect(m.minPct).toBeLessThanOrEqual(100);
    expect(m.minPct).toBeGreaterThan(50);
  });
});

describe('rente en looptijd', () => {
  it('rente van de maand is saldo x percentage / 12', () => {
    expect(monthlyInterest(640, 14.9)).toBe(7.95);
    expect(monthlyInterest(1100, 2.56)).toBe(2.35);
    expect(monthlyInterest(0, 10)).toBe(0);
    expect(monthlyInterest(100, 0)).toBe(0);
  });

  it('schat looptijd en totale rente', () => {
    const est = payoffEstimate(640, 14.9, 80);
    expect(est.months).toBe(9);
    expect(est.totalInterest).toBeGreaterThan(36);
    expect(est.totalInterest).toBeLessThan(40);
    expect(est.paysOff).toBe(true);
    expect(payoffEstimate(800, 0, 80).months).toBe(10);
  });

  it('herkent een aflossing die de rente niet dekt', () => {
    const est = payoffEstimate(10000, 12, 50);
    expect(est.months).toBeNull();
    expect(est.paysOff).toBe(false);
    expect(payoffEstimate(100, 5, 0).months).toBeNull();
    expect(payoffEstimate(0, 5, 10).months).toBe(0);
  });

  it('maakt snelknoppen kleiner dan het saldo plus Alles', () => {
    expect(paymentPresets(640)).toEqual([50, 80, 160, 640]);
    expect(paymentPresets(60)).toEqual([50, 60]);
    expect(paymentPresets(0)).toEqual([]);
  });
});

describe('analyse', () => {
  it('maakt horizontale balken relatief aan de grootste categorie', () => {
    const bars = categoryBars([
      { category: 'Abonnement', amount: 96 },
      { category: 'Vaste Last', amount: 963.2 },
      { category: 'Overig', amount: 0 },
    ]);
    expect(bars.map((b) => b.category)).toEqual(['Vaste Last', 'Abonnement']);
    expect(bars[0]?.widthPct).toBe(100);
    expect(bars[1]?.widthPct).toBe(10);
    expect((bars[0]?.sharePct ?? 0) + (bars[1]?.sharePct ?? 0)).toBeGreaterThanOrEqual(99);
  });

  it('sorteert open posten op bedrag, grootste eerst', () => {
    const rows = sortOpenFirstLargest([{ name: 'b', amount: 10 }, { name: 'a', amount: 10 }, { name: 'c', amount: 700 }]);
    expect(rows.map((r) => r.name)).toEqual(['c', 'a', 'b']);
  });
});
