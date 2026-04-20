import type { TripRow } from "../store/useAppStore";
import { peso } from "./utils";

function pesoOrBlank(n: number | undefined | null): string {
  const value = Number(n || 0);
  return value === 0 ? "" : peso(value);
}

function escapeCsv(v: string | number): string {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function exportTripsCsv(rows: TripRow[], filename?: string) {
  const headers = [
    "Week",
    "Date",
    "Status",
    "Shipment #",
    "Rate",
    "Trips",
    "Crew Salary",
    "Cash Advance",
    "Reimbursements",
    "Expenses",
    "Note",
    "Gross",
    "Net",
    "Payable",
  ];
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) =>
      [
        r.week,
        r.dateText,
        r.status,
        r.shipmentNumber,
        r.rate,
        r.trips,
        r.crewSalary,
        r.cashAdvance,
        r.reimbursements,
        r.expenses,
        r.note,
        r.grossIncome,
        r.netIncome,
        r.payable,
      ]
        .map(escapeCsv)
        .join(","),
    ),
  ];
  const blob = new Blob([lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const d = new Date();
  a.download =
    filename ||
    `NEXTMILE_${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportPayslip(
  rows: TripRow[],
  truckLabel: string,
  startDate?: string,
  endDate?: string,
) {
  const totalTrips = rows.reduce((s, r) => s + (r.trips || 0), 0);
  const totalPayable = rows.reduce(
    (s, r) => s + (r.paid ? 0 : r.payable || 0),
    0,
  );

  const formatDateTime = (d: Date) =>
    d.toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

  const formatDateLong = (value?: string) => {
    if (!value) return "";
    const d = new Date(value);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const rangeLabel =
    startDate && endDate
      ? `${formatDateLong(startDate)} to ${formatDateLong(endDate)}`
      : "All Dates";

  const rowHtml = rows
    .filter((r) => r.status === "Working Day" && !r.paid)
    .map(
      (r) =>
        `<tr><td>${escHtml(r.dateText)}</td><td>${escHtml(r.shipmentNumber)}</td><td>${r.trips}</td><td>${pesoOrBlank(r.crewSalary)}</td><td>${pesoOrBlank(r.cashAdvance)}</td><td>${pesoOrBlank(r.reimbursements)}</td><td>${pesoOrBlank(r.paid ? 0 : r.payable)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip</title>
<style>
@page { size: A4; margin: 18mm; }
body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 0 24px; }
.header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #000; }
.title { font-size: 24px; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.05em; }
.meta { font-size: 13px; line-height: 1.6; color: #555; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; }
th, td { padding: 10px 8px; font-size: 12px; text-align: center; }
thead th { border-bottom: 2px solid #000; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #333; }
tbody td { border-bottom: 1px solid #ddd; }
tbody tr:nth-child(even) td { background-color: #f9fafb; }
.totals { margin-top: 28px; border-top: 2px solid #000; padding-top: 14px; width:100%; }
.total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 600; margin-bottom: 6px; max-width: 400px; margin-left: auto; }
.label { letter-spacing: 0.05em; color: #333; }
</style></head><body>
<div class="header">
  <div class="title">CREW SALARY</div>
  <div class="meta">
    <strong>Range:</strong> ${escHtml(rangeLabel)}<br>
    <strong>Truck:</strong> ${escHtml(truckLabel)}<br>
    <strong>Generated:</strong> ${formatDateTime(new Date())}
  </div>
</div>
<table>
  <thead><tr><th>Date</th><th>Shipment #</th><th>Trips</th><th>Crew Salary</th><th>Cash Advance</th><th>Reimbursements</th><th>Payable</th></tr></thead>
  <tbody>${rowHtml || '<tr><td colspan="7" style="text-align:center;color:#999;padding:20px">No working days found</td></tr>'}</tbody>
</table>
<div class="totals">
  <div class="total-row"><span class="label">TOTAL TRIPS</span><span>${totalTrips.toLocaleString()}</span></div>
  <div class="total-row"><span class="label">TOTAL PAYABLE</span><span>${pesoOrBlank(totalPayable)}</span></div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}

export function exportMonthlyReport(
  rows: TripRow[],
  truckLabel: string,
  periodText: string,
) {
  const totalTrips = rows.reduce((s, r) => s + (r.trips || 0), 0);
  const totalGross = rows.reduce((s, r) => s + (r.grossIncome || 0), 0);
  const totalPayable = rows.reduce(
    (s, r) => s + (r.reportPayable || r.payable || 0),
    0,
  );
  const totalExpenses = rows.reduce((s, r) => s + (r.expenses || 0), 0);
  const totalNet = rows.reduce(
    (s, r) => s + (r.reportNetIncome || r.netIncome || 0),
    0,
  );
  const totalCrewSalary = rows.reduce((s, r) => s + (r.crewSalary || 0), 0);

  const escapeNoteWithLineBreaks = (note: string) => {
    const lines = note
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return "";

    return lines.map((line) => escHtml(line)).join("<br>");
  };

  // Build a per-day note map so duplicate notes on the same date are removed,
  // and multiple expense notes on the same day show as separate lines.
  const notesByDate = new Map<string, string>();
  const noteLinesByDate = new Map<string, Set<string>>();

  for (const r of rows) {
    const dateKey = r.dateIso || r.dateText || "";
    if (!dateKey) continue;

    const existing = noteLinesByDate.get(dateKey) || new Set<string>();
    const rawNote = String(r.note || "");

    rawNote
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line) => existing.add(line));

    noteLinesByDate.set(dateKey, existing);
  }

  for (const [dateKey, lines] of noteLinesByDate.entries()) {
    notesByDate.set(
      dateKey,
      Array.from(lines)
        .map((line) => escHtml(line).replace(/\s*\|\s*/g, "<br>"))
        .join("<br>"),
    );
  }

  const seenDates = new Set<string>();

  const rowHtml = rows
    .map((r) => {
      const dateKey = r.dateIso || r.dateText || "";
      const isFirstRowForDate = !seenDates.has(dateKey);

      if (isFirstRowForDate && dateKey) {
        seenDates.add(dateKey);
      }

      const expenseNoteHtml = isFirstRowForDate
        ? notesByDate.get(dateKey) ||
          escapeNoteWithLineBreaks(String(r.note || ""))
        : "";

      return `<tr>
        <td class="date-col">${escHtml(r.dateText)}</td>
        <td>${escHtml(r.shipmentNumber)}</td>
        <td>${pesoOrBlank(r.rate)}</td>
        <td>${r.trips}</td>
        <td>${pesoOrBlank(r.crewSalary)}</td>
        <td>${pesoOrBlank(r.cashAdvance)}</td>
        <td>${pesoOrBlank(r.reimbursements)}</td>
        <td>${pesoOrBlank(r.expenses)}</td>
        <td class="expense-note">${expenseNoteHtml}</td>
        <td>${pesoOrBlank(r.grossIncome)}</td>
        <td>${pesoOrBlank(r.reportNetIncome ?? r.netIncome)}</td>
        <td>${pesoOrBlank(r.reportPayable ?? r.payable)}</td>
      </tr>`;
    })
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Monthly Report</title>
<style>
@page{size:A4;margin:16mm}
body{
  font-family:Arial,sans-serif;
  color:#111;
  margin:0;
  padding:0;
}

.header{
  width:100%;
  text-align:center;
  margin-bottom:18px;
  padding-bottom:10px;
  border-bottom:2px solid #000;
}

.title{
  font-size:22px;
  font-weight:700;
  margin-bottom:6px;
}

.meta{
  font-size:13px;
  line-height:1.6;
  color:#555;
}
table{
  width:100%;
  border-collapse:collapse;
  margin-top:14px;
}
th,td{padding:7px 6px;font-size:11px;text-align:center;vertical-align:middle}
thead th{border-bottom:2px solid #000;font-weight:700;white-space:nowrap;text-transform:uppercase;font-size:10px;letter-spacing:0.05em}
tbody td{border-bottom:1px solid #ddd}
tbody tr:nth-child(even) td{background-color:#f9fafb}
.expense-note{
  text-align:center;
  vertical-align:middle;
  white-space:pre-line;
  line-height:1.4;
  word-break:break-word;
}
.date-col{
  white-space:nowrap;
  min-width:120px;
}
.totals{
  margin-top:24px;
  border-top:2px solid #000;
  padding-top:14px;
  width:100%;
  box-sizing:border-box;
}
.total-row{display:grid;grid-template-columns:1fr auto;max-width:420px;margin-left:auto;font-size:14px;font-weight:600;margin-bottom:4px}
.label{letter-spacing:0.04em;color:#333}
</style></head><body>

<div class="header">
  <div class="title">Monthly Report for ${escHtml(truckLabel)}</div>
  <div class="meta"><strong>Period:</strong> ${escHtml(periodText)}<br><strong>Generated:</strong> ${new Date().toLocaleString()}</div>
</div>
<table>
  <thead><tr><th>Date</th><th>Shipment #</th><th>Rate</th><th>Trips</th><th>Crew Salary</th><th>Cash Adv</th><th>Reimb</th><th>Expenses</th><th>Expense Note</th><th>Gross</th><th>Net</th><th>Payable</th></tr></thead>
  <tbody>${rowHtml || '<tr><td colspan="12">No rows</td></tr>'}</tbody>
</table>
<div class="totals">
  <div class="total-row"><span class="label">TOTAL TRIPS</span><span>${totalTrips.toLocaleString()}</span></div>
  <div class="total-row"><span class="label">GROSS INCOME</span><span>${peso(totalGross)}</span></div>
  <div class="total-row"><span class="label">TOTAL CREW SALARY</span><span>${peso(totalCrewSalary)}</span></div>
  <div class="total-row"><span class="label">TOTAL EXPENSES</span><span>${peso(totalExpenses)}</span></div>
  <div class="total-row"><span class="label">TOTAL PAYABLE</span><span>${peso(totalPayable)}</span></div>
  <div class="total-row"><span class="label">NET INCOME</span><span>${peso(totalNet)}</span></div>
</div>
<script>window.onload=function(){window.print();}</script>
</body></html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}
