import type { TripRow } from "../store/useAppStore";
import { peso } from "./utils";
import { getExpenseBreakdown } from "./expenseSummary";
import { getColumnLabels } from "./columnLabels";

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
  const labels = getColumnLabels();
  const headers = [
    "Week",
    "Date",
    "Status",
    labels.shipmentNumber,
    "Rate",
    "Trips",
    "Crew Salary",
    labels.cashAdvance,
    "Reimbursements",
    "Expenses",
    "Note",
    "Gross",
    "Net",
    "Payable",
  ];
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => {
      const reimbValue = Number(r.reimbursements || 0);

      return [
        r.week,
        r.dateText,
        r.status,
        r.shipmentNumber,
        r.rate,
        r.trips,
        r.crewSalary,
        r.cashAdvance,
        reimbValue > 0 ? (r.paid ? `✔ ${peso(reimbValue)}` : reimbValue) : "",
        r.expenses,
        r.note,
        r.grossIncome,
        r.netIncome,
        r.payable,
      ]
        .map(escapeCsv)
        .join(",");
    }),
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
  const labels = getColumnLabels();
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
    .filter((r) => r.status === "Working Day")
    .map(
      (r) =>
        `<tr><td>${escHtml(r.dateText)}</td><td>${escHtml(r.shipmentNumber)}</td><td>${pesoOrBlank(r.crewSalary)}</td><td>${pesoOrBlank(r.cashAdvance)}</td><td>
  ${(() => {
    const reimbValue = Number(r.reimbursements || 0);
    if (reimbValue === 0) return "";

    return r.paid ? `✔ <s>${peso(reimbValue)}</s>` : peso(reimbValue);
  })()}
</td><td>${peso(r.paid ? 0 : r.payable)}</td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Payslip</title>
<style>
@page { size: A4; }
body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 0 24px; }
.header { text-align: center; margin-bottom: 20px; padding-bottom: 10px; border-bottom: 2px solid #000; }
.title { font-size: 24px; font-weight: 700; margin-bottom: 6px; letter-spacing: 0.05em; }
.meta { font-size: 13px; line-height: 1.6; color: #000; }
table { width: 100%; border-collapse: collapse; margin-top: 16px; }
th, td { padding: 10px 8px; font-size: 12px; text-align: center; }
thead th { border-bottom: 2px solid #000; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; color: #333; }
tbody td { border-bottom: 1px solid #ddd; }
tbody tr:nth-child(even) td { background-color: #f9fafb; }
.totals { margin-top: 28px; border-top: 2px solid #000; padding-top: 14px; width:100%; }
.total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 600; margin-bottom: 6px; max-width: 400px; margin-left: auto; }
.label { letter-spacing: 0.05em; color: #333; }
.date-col { white-space: nowrap; }
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
  <thead><tr><th class="date-col">Date</th><th>${labels.shipmentNumber}</th><th>Crew Salary</th><th>${labels.cashAdvance}</th><th>Reimbursements</th><th>Payable</th></tr></thead>
  <tbody>${rowHtml || '<tr><td colspan="6" style="text-align:center;color:#999;padding:20px">No working days found</td></tr>'}</tbody>
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
  expenseRows: { category?: string; amount?: number }[] = [],
) {
  const labels = getColumnLabels();
  const totalTrips = rows.reduce((s, r) => s + Number(r.trips || 0), 0);
  const totalGross = rows.reduce((s, r) => s + Number(r.grossIncome || 0), 0);
  const totalPayable = rows.reduce(
    (s, r) => s + Number(r.reportPayable || r.payable || 0),
    0,
  );
  const totalExpenses = rows.reduce((s, r) => s + Number(r.expenses || 0), 0);
  const totalNet = rows.reduce(
    (s, r) => s + Number(r.reportNetIncome || r.netIncome || 0),
    0,
  );
  const totalCrewSalary = rows.reduce(
    (s, r) => s + Number(r.crewSalary || 0),
    0,
  );
  const expenseSummary = getExpenseBreakdown(expenseRows);

  const expenseRatio =
    totalGross > 0 ? ((totalExpenses / totalGross) * 100).toFixed(1) : "0.0";
  const netMargin =
    totalGross > 0 ? ((totalNet / totalGross) * 100).toFixed(1) : "0.0";
  const avgPerTrip = totalTrips > 0 ? totalGross / totalTrips : 0;
  const crewCostRatio =
    totalGross > 0 ? ((totalCrewSalary / totalGross) * 100).toFixed(1) : "0.0";

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

  // const formatDateLong = (value?: string) => {
  //   if (!value) return "";
  //   const d = new Date(value);
  //   return d.toLocaleDateString("en-US", {
  //     weekday: "long",
  //     year: "numeric",
  //     month: "long",
  //     day: "numeric",
  //   });
  // };

  const escapeBreakdownText = (value: string) => {
    const lines = String(value || "")
      .replace(/\r/g, "")
      .split("\n")
      .flatMap((line) => line.split(/\s*\|\s*/))
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) return "";

    return lines.map((line) => escHtml(line)).join("<br>");
  };

  const rangeLabel =
    periodText && periodText.trim() ? periodText.trim() : "Selected Period";

  const seenDates = new Set<string>();

  const rowHtml = rows
    .map((r) => {
      const dateKey = r.dateIso || r.dateText || "";
      const isFirstRowForDate = !seenDates.has(dateKey);

      if (isFirstRowForDate && dateKey) {
        seenDates.add(dateKey);
      }

      const expenseNoteHtml = isFirstRowForDate
        ? escapeBreakdownText(String(r.expenseBreakdown || r.note || ""))
        : "";

      return `<tr>
        <td class="date-col">${escHtml(r.dateText)}</td>
        <td>${escHtml(r.shipmentNumber)}</td>
        <td>${pesoOrBlank(r.rate)}</td>
        <td>${pesoOrBlank(r.crewSalary)}</td>
        <td>${pesoOrBlank(r.cashAdvance)}</td>
        <td>
  ${(() => {
    const reimbValue = Number(r.reimbursements || 0);
    if (reimbValue === 0) return "";

    return r.paid ? `✔ <s>${peso(reimbValue)}</s>` : peso(reimbValue);
  })()}
</td>
        <td>${pesoOrBlank(r.expenses)}</td>
        <td class="expense-breakdown">${expenseNoteHtml}</td>
        <td>${pesoOrBlank(r.grossIncome)}</td>
        <td>${pesoOrBlank(r.reportNetIncome ?? r.netIncome)}</td>
        <td>${pesoOrBlank(r.reportPayable ?? r.payable)}</td>
      </tr>`;
    })
    .join("");

  const safeFilePart = (value: string) =>
    String(value || "")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_");

  const monthPart = safeFilePart(periodText);
  const truckPart = safeFilePart(truckLabel);
  const reportTitle = `Monthly Report_${monthPart}_${truckPart}`;

  const expenseBreakdownHtml =
    expenseSummary.entries.length > 0
      ? `
        ${expenseSummary.entries
          .map((item) => {
            return `
              <div style="display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-bottom:1px dashed #e5e7eb;font-size:12px;color:#6b7280;">
                <span style="font-weight:700;">${escHtml(item.category)}</span>
                <span style="font-weight:700;color:#111827;">${item.percent.toFixed(1)}% (${peso(item.amount)})</span>
              </div>
            `;
          })
          .join("")}
        <div style="display:flex;justify-content:space-between;gap:12px;padding-top:8px;margin-top:6px;border-top:2px solid #d1d5db;font-size:12px;">
          <span style="font-weight:800;color:#111827;">TOTAL</span>
          <span style="font-weight:800;">${peso(expenseSummary.total)}</span>
        </div>
      `
      : `<div style="font-size:12px;color:#94a3b8;">No expenses found</div>`;

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escHtml(reportTitle)}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 14mm;
    }

    body {
      font-family: Arial, sans-serif;
      color: #111;
      margin: 0;
      padding: 0;
      font-size: 11px;
    }

    .header {
      width: 100%;
      text-align: center;
      margin-bottom: 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid #000;
    }

    .title {
      font-size: 22px;
      font-weight: 700;
      margin-bottom: 6px;
      letter-spacing: 0.04em;
    }

    .subtitle {
      font-size: 13px;
      line-height: 1.5;
      color: #000;
    }

    tbody tr:nth-child(even) td {
      background-color: #f9fafb;
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      tbody tr:nth-child(even) td {
        background-color: #f9fafb !important;
      }
    }

    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
      align-items: stretch;
    }

    .summary-card,
    .summary-card * {
      color: #111827 !important;
    }

    .summary-card {
      border: 1px solid #111827;
      border-radius: 10px;
      padding: 10px 12px;
      background: #fff;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 4px 0;
      border-bottom: 1px dashed #e5e7eb;
      font-size: 12px;
    }

    .summary-row:last-child {
      border-bottom: none;
    }

    .summary-label {
      font-weight: 600;
      color: #6b7280;
    }

    .summary-value {
      font-weight: 700;
      color: #111827;
      text-align: right;
      white-space: nowrap;
    }

    .section-title {
      font-size: 12px;
      font-weight: 700;
      margin: 24px 0 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .table-wrap {
      width: 100%;
    }

    table{
      width:100%;
      border-collapse:collapse;
      table-layout:fixed;
    }

    th,td{
      padding:7px 5px;
      font-size:9.5px;
      text-align:left;
      vertical-align:top;
      border-bottom:1px solid #ddd;
      overflow-wrap:anywhere;
      word-break:break-word;
    }

    thead th{
      border-bottom:2px solid #000;
      font-weight:700;
      text-transform:uppercase;
      white-space:nowrap;
      letter-spacing:0.04em;
      font-size:8.5px;
    }

    .expense-breakdown{
      text-align:left;
      vertical-align:top;
      white-space:nowrap;
      line-height:1.35;
      overflow-wrap:anywhere;
      word-break:break-word;
    }

    .date-col {
      white-space: nowrap;
      min-width: 120px;
    }

    .totals {
      margin-top: 18px;
      border-top: 2px solid #000;
      padding-top: 12px;
      width: 100%;
      box-sizing: border-box;
    }

    .total-row {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 12px;
      max-width: 420px;
      margin-left: auto;
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 5px;
    }

    .label {
      letter-spacing: 0.04em;
      color: #333;
    }

    .nothing-follows {
      text-align: center;
      font-size: 11px;
      font-weight: 700;
      margin-top: 14px;
      letter-spacing: 0.08em;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">Monthly Report for ${escHtml(truckLabel)}</div>
    <div class="subtitle">
      <strong>Period:</strong> ${escHtml(rangeLabel)}<br>
      <strong>Generated:</strong> ${formatDateTime(new Date())}
    </div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="summary-row">
        <span class="summary-label">Total Trips</span>
        <span class="summary-value">${totalTrips.toLocaleString()}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Gross Income</span>
        <span class="summary-value">${peso(totalGross)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total Crew Salary</span>
        <span class="summary-value">${peso(totalCrewSalary)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Total Expenses</span>
        <span class="summary-value">${peso(totalExpenses)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Net Income</span>
        <span class="summary-value">${peso(totalNet)}</span>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-row">
        <span class="summary-label">Total Payable</span>
        <span class="summary-value">${peso(totalPayable)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Expense Ratio</span>
        <span class="summary-value">${expenseRatio}%</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Crew Cost Ratio</span>
        <span class="summary-value">${crewCostRatio}%</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Net Margin (After Salary & Expenses)</span>
        <span class="summary-value">${netMargin}%</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Avg per Trip</span>
        <span class="summary-value">${peso(avgPerTrip)}</span>
      </div>
      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;line-height:1.5;">
        <div>Expense Ratio = Expenses / Gross × 100</div>
        <div>Crew Cost Ratio = Crew Salary / Gross × 100</div>
        <div>Net Margin = Net Income / Gross × 100</div>
      </div>
    </div>

    <div class="summary-card">
      <div class="section-title" style="margin-top:4px;margin-bottom:2px;">Expense Breakdown</div>
      <div class="muted" style="margin-bottom:8px;">Distribution by category</div>
      ${expenseBreakdownHtml}
    </div>
  </div>

  <div class="section-title">Detailed Report</div>
  <div class="table-wrap">
    <table>
      <colgroup>
        <col style="width:9%">
        <col style="width:10%">
        <col style="width:7%">
        <col style="width:7%">
        <col style="width:7%">
        <col style="width:7%">
        <col style="width:7%">
        <col style="width:23%">
        <col style="width:6%">
        <col style="width:7%">
        <col style="width:7%">
      </colgroup>
      <thead>
        <tr>
          <th>Date</th>
          <th>${labels.shipmentNumber}</th>
          <th>Rate</th>
          <th>Crew Salary</th>
          <th>${labels.cashAdvance}</th>
          <th>Reimb</th>
          <th>Expenses</th>
          <th class="expense-breakdown">Expense Breakdown</th>
          <th>Gross</th>
          <th>Net</th>
          <th>Payable</th>
        </tr>
      </thead>
      <tbody>
        ${rowHtml || '<tr><td colspan="11" style="text-align:center;color:#999;padding:20px">No rows</td></tr>'}
      </tbody>
    </table>
  </div>

  <div class="nothing-follows">***** NOTHING FOLLOWS *****</div>

  <script>
    window.onload = function () {
      window.print();
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1200,height=700");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
  }
}
