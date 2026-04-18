type NoteTrip = {
  dateIso: string;
  note?: string;
  [key: string]: any;
};

type NoteExpense = {
  date: Date;
  category?: string;
  description?: string;
};

export function attachExpenseNotes(trips: NoteTrip[], expenses: NoteExpense[]) {
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
