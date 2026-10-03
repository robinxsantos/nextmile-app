type NoteTrip = {
  _id: any;
  truck?: any;
  dateIso: string;
  note?: string;
  expenseBreakdown?: string;
  [key: string]: any;
};

type NoteExpense = {
  _id?: any;
  date: Date;
  truck?: any;
  tripId?: any;
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
  const getTruckId = (value: any) =>
    value && typeof value === "object"
      ? String(value._id || "")
      : String(value || "");

  const getTripId = (value: any) =>
    value && typeof value === "object"
      ? String(value._id || "")
      : String(value || "");

  const buildLabel = (expense: NoteExpense) => {
    const baseLabel = [expense.category, expense.description]
      .filter(Boolean)
      .join(": ")
      .trim();

    return expense.reimbursed
      ? `${baseLabel || "Expense"} (Reimbursed)`
      : baseLabel || "Expense";
  };

  return trips.map((trip) => {
    const tripId = String(trip._id);
    const tripTruckId = getTruckId(trip.truck);

    // Expenses explicitly linked to this exact trip.
    const linkedExpenses = expenses.filter(
      (expense) => getTripId(expense.tripId) === tripId,
    );

    // Legacy/manual expenses without tripId for the same truck + date.
    const dateLevelExpenses = expenses.filter((expense) => {
      if (expense.tripId) return false;

      const expenseTruckId = getTruckId(expense.truck);
      const expenseDate = expense.date.toISOString().slice(0, 10);

      return expenseTruckId === tripTruckId && expenseDate === trip.dateIso;
    });

    // First trip owns legacy/manual date-level expenses.
    const ownerTrip = trips.find(
      (row) =>
        getTruckId(row.truck) === tripTruckId && row.dateIso === trip.dateIso,
    );

    const ownedDateExpenses =
      String(ownerTrip?._id || "") === tripId ? dateLevelExpenses : [];

    const tripExpenses = [...linkedExpenses, ...ownedDateExpenses];

    const expNote = tripExpenses
      .map((expense) => buildLabel(expense))
      .join(" | ");

    const expBreakdown = tripExpenses
      .map((expense) => {
        const label = buildLabel(expense);

        return tripExpenses.length > 1
          ? `${label} - ${formatPeso(expense.amount || 0)}`
          : label;
      })
      .join("\n");

    return {
      ...trip,
      note: expNote || trip.note || "",
      expenseBreakdown: expBreakdown,

      expenseItems: tripExpenses.map((expense) => ({
        _id: String(expense._id || ""),
        category: expense.category || "",
        description: expense.description || "",
        amount: Number(expense.amount || 0),
        reimbursed: Boolean(expense.reimbursed),
      })),
    };
  });
}
