type NoteTrip = {
  dateIso: string;
  note?: string;
  expenseBreakdown?: string;
  [key: string]: any;
};

type NoteExpense = {
  date: Date;
  category?: string;
  description?: string;
  amount?: number;
  reimbursed?: boolean;
};

type BreakdownItem = {
  label: string;
  amountText: string;
};

function formatPeso(amount: number): string {
  return `₱${Number(amount || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function attachExpenseNotes(trips: NoteTrip[], expenses: NoteExpense[]) {
  const expenseNoteMap: Record<string, string> = {};
  const expenseBreakdownMap: Record<string, BreakdownItem[]> = {};

  expenses.forEach((e) => {
    const dateKey = e.date.toISOString().slice(0, 10);

    if (e.reimbursed) return;

    const label = [e.category, e.description].filter(Boolean).join(": ").trim();
    const amountText = formatPeso(e.amount || 0);

    if (!expenseNoteMap[dateKey]) {
      expenseNoteMap[dateKey] = label;
    } else if (label) {
      expenseNoteMap[dateKey] += " | " + label;
    }

    if (!expenseBreakdownMap[dateKey]) {
      expenseBreakdownMap[dateKey] = [];
    }

    expenseBreakdownMap[dateKey].push({
      label: label || "Expense",
      amountText,
    });
  });

  return trips.map((t) => {
    const expNote = expenseNoteMap[t.dateIso] || "";
    const items = expenseBreakdownMap[t.dateIso] || [];

    const expBreakdown = items
      .map((item) =>
        items.length > 1 ? `${item.label} - ${item.amountText}` : item.label,
      )
      .join("\n");

    return {
      ...t,
      note: t.note || expNote,
      expenseBreakdown: t.expenseBreakdown || expBreakdown,
    };
  });
}
