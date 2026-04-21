export type ExpenseLike = {
  category?: string;
  amount?: number;
};

export type ExpenseBreakdownItem = {
  category: string;
  amount: number;
  percent: number;
};

export function getExpenseBreakdown(items: ExpenseLike[]) {
  const byCategory: Record<string, number> = {};

  items.forEach((item) => {
    const category = (item.category || "OTHERS").trim().toUpperCase();
    const amount = Number(item.amount || 0);
    byCategory[category] = (byCategory[category] || 0) + amount;
  });

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, amt]) => sum + amt, 0);

  return {
    entries: entries.map(([category, amount]) => ({
      category,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    })) as ExpenseBreakdownItem[],
    total,
  };
}
