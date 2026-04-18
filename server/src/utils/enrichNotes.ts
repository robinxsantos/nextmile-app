export function attachExpenseNotes(trips: any[], expenses: any[]) {
  const expenseNoteMap: Record<string, string> = {};

  expenses.forEach((e) => {
    const dateKey = e.date.toISOString().slice(0, 10);
    const label = [e.category, e.description].filter(Boolean).join(": ");

    if (!expenseNoteMap[dateKey]) expenseNoteMap[dateKey] = label;
    else expenseNoteMap[dateKey] += " | " + label;
  });

  return trips.map((t) => {
    const expNote = expenseNoteMap[t.dateIso] || "";
    if (!t.note && expNote) {
      return { ...t, note: expNote };
    }
    return t;
  });
}
