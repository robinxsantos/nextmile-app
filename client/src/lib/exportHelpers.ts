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
    "VAT",
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
        r.vat,
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
        `<tr><td>${escHtml(r.dateText)}</td><<td class="shipment-col">${escHtml(r.shipmentNumber)}</td><td>${pesoOrBlank(r.crewSalary)}</td><td>${pesoOrBlank(r.cashAdvance)}</td><td>
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
  <thead><tr><th class="date-col">Date</th><<th class="shipment-col">${labels.shipmentNumber}</th><th>Crew Salary</th><th>${labels.cashAdvance}</th><th>Reimbursements</th><th>Payable</th></tr></thead>
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
  clientMode = false,
  deductFuel = false,
  clientName = "",
  billedTo = "",
  billingType: "subcontracted" | "direct" = "subcontracted",
) {
  const labels = getColumnLabels();

  const clientRows = clientMode
    ? rows.filter((r) => r.status === "Working Day")
    : rows;

  const totalTrips = clientRows.reduce((s, r) => s + Number(r.trips || 0), 0);

  const totalGross = clientRows.reduce(
    (s, r) => s + Number(r.grossIncome || 0),
    0,
  );

  const totalVat = clientRows.reduce((s, r) => s + Number(r.vat || 0), 0);
  const parkingPasswayTotal = expenseRows
    .filter((e) => (e.category || "").toUpperCase() === "PARKING/PASSWAY")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const fuelTotal = expenseRows
    .filter((e) => (e.category || "").toUpperCase() === "FUEL")
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const totalReceivable =
    totalGross + parkingPasswayTotal - totalVat - (deductFuel ? fuelTotal : 0);
  const totalPayable = rows.reduce(
    (s, r) => s + Number(r.reportPayable || r.payable || 0),
    0,
  );
  const totalNet = rows.reduce(
    (s, r) => s + Number(r.reportNetIncome || r.netIncome || 0),
    0,
  );
  const totalCrewSalary = rows.reduce(
    (s, r) => s + Number(r.crewSalary || 0),
    0,
  );
  const expenseSummary = getExpenseBreakdown(expenseRows);
  const totalExpenses = expenseSummary.total;

  const expenseRatio =
    totalGross > 0 ? ((totalExpenses / totalGross) * 100).toFixed(1) : "0.0";
  const netMargin =
    totalGross > 0 ? ((totalNet / totalGross) * 100).toFixed(1) : "0.0";
  const avgPerTrip = totalTrips > 0 ? totalGross / totalTrips : 0;
  // NEW: Profit per Trip (TRUE value)
  const profitPerTrip = totalTrips > 0 ? totalNet / totalTrips : 0;

  // OPTIONAL (HIGHLY RECOMMENDED): Break-even per Trip
  const breakEvenPerTrip =
    totalTrips > 0 ? (totalCrewSalary + totalExpenses) / totalTrips : 0;
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

  const formatStatementGenerated = (d: Date) => {
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

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

  const statementDates = rows
    .map((r) => new Date(r.dateIso || r.dateText))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  const fallbackDate = new Date();

  const statementPeriodStart = statementDates[0] ?? fallbackDate;

  const statementPeriodEnd =
    statementDates[statementDates.length - 1] ?? fallbackDate;

  const monthlyPeriodMatch = periodText.match(
    /^Month of ([A-Za-z]+) (\d{4})$/i,
  );

  const customPeriodMatch = periodText.match(
    /^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+to\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/i,
  );

  const statementTruck = String(truckLabel || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  let statementYear: number;
  let statementPeriodCode: string;

  if (monthlyPeriodMatch) {
    // Example:
    // Month of JUNE 2026
    // → NXM-2026-0006-CCR5297

    const monthDate = new Date(
      `${monthlyPeriodMatch[1]} 1, ${monthlyPeriodMatch[2]}`,
    );

    statementYear = Number(monthlyPeriodMatch[2]);

    const month = String(monthDate.getMonth() + 1).padStart(2, "0");

    statementPeriodCode = `00${month}`;
  } else if (customPeriodMatch) {
    // Example:
    // July 05, 2026 to July 10, 2026
    // → NXM-2026-07050710-CCR5297

    const startMonthDate = new Date(
      `${customPeriodMatch[1]} 1, ${customPeriodMatch[3]}`,
    );

    const endMonthDate = new Date(
      `${customPeriodMatch[4]} 1, ${customPeriodMatch[6]}`,
    );

    statementYear = Number(customPeriodMatch[3]);

    const startMonth = String(startMonthDate.getMonth() + 1).padStart(2, "0");
    const startDay = String(customPeriodMatch[2]).padStart(2, "0");

    const endMonth = String(endMonthDate.getMonth() + 1).padStart(2, "0");
    const endDay = String(customPeriodMatch[5]).padStart(2, "0");

    statementPeriodCode = `${startMonth}${startDay}${endMonth}${endDay}`;
  } else {
    // Fallback in case periodText has an unexpected format
    statementYear = statementPeriodEnd.getFullYear();

    const month = String(statementPeriodEnd.getMonth() + 1).padStart(2, "0");

    statementPeriodCode = `00${month}`;
  }

  const statementNumber = `NXM-${statementYear}-${statementPeriodCode}-${statementTruck}`;

  const formatStatementDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    });

  const statementPeriod =
    periodText && periodText.trim()
      ? periodText.trim()
      : `${formatStatementDate(statementPeriodStart)} to ${formatStatementDate(statementPeriodEnd)}`;

  const formatDateShort = (value: string) => {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

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
        <td class="date-col">${escHtml(formatDateShort(r.dateIso || r.dateText))}</td>
        <td class="shipment-col">${escHtml(r.shipmentNumber)}</td>
        <td>${pesoOrBlank(r.rate)}</td>
        <td>${pesoOrBlank(r.vat)}</td>
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
        <td>${clientMode ? "" : pesoOrBlank(r.reportNetIncome ?? r.netIncome)}</td>
      </tr>`;
    })
    .join("");

  const clientRowHtml = clientRows
    .map((r) => {
      return `<tr>
      <td class="date-col">${escHtml(
        formatDateShort(r.dateIso || r.dateText),
      )}</td>
      <td class="shipment-col">${escHtml(r.shipmentNumber)}</td>
      <td class="amount-col">${pesoOrBlank(r.rate)}</td>
      <td class="amount-col">${pesoOrBlank(r.vat)}</td>
      <td class="amount-col">${pesoOrBlank(r.grossIncome)}</td>
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

  const reportTitle = clientMode
    ? statementNumber
    : `Monthly Report_${monthPart}_${truckPart}`;

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
      size: ${clientMode ? "A4 portrait" : "A4 landscape"};
      margin: ${clientMode ? "12mm 12mm 16mm 12mm" : "14mm"};
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
    }

    .subtitle {
      font-size: 13px;
      line-height: 1.5;
      color: #000;
    }

    .statement-meta {
      display: grid;
      grid-template-columns: 38% 62%;
      gap: 0;
      margin: 14px 0 18px;
      font-size: 10.5px;
    }

    .statement-info-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 0.78fr);
      gap: 24px;
      align-items: start;
      margin: 14px 0 20px;
      width: 100%;
      box-sizing: border-box;
    }

    .statement-info-left {
      min-width: 0;
      padding-top: 2px;
    }

    .statement-info-right {
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
    }

    .statement-details {
      margin-top: 34px;
    }

    .statement-detail-row {
      display: grid;
      grid-template-columns: 105px 1fr;
      gap: 12px;
      padding: 3px 0;
      font-size: 10px;
    }

    .statement-detail-row span:last-child {
      font-weight: 700;
      color: #111827;
    }

    .client-account-summary {
      width: 100%;
      max-width: 100%;
      box-sizing: border-box;
    }

    .client-account-summary .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 6px 8px;
      border-bottom: 1px solid #dbe1e7;
      font-size: 10px;
    }

    .client-account-summary .summary-label {
      font-weight: 600;
      color: #111827;
    }

    .client-account-summary .summary-value {
      font-weight: 700;
      color: #111827;
      text-align: right;
      white-space: nowrap;
    }

    .client-account-summary .statement-payable-row {
      margin-top: 2px;
      padding-top: 8px;
      padding-bottom: 8px;
      border-top: 2px solid #0f4c6e;
      border-bottom: 2px solid #0f4c6e;
    }

    .client-account-summary .statement-payable-row .summary-label,
    .client-account-summary .statement-payable-row .summary-value {
      font-size: 12px;
      font-weight: 800;
    }

    .summary-grid.client-summary-hidden {
      display: none;
    }

    .statement-meta-left {
      min-width: 0;
    }

    .statement-meta-heading {
      margin-bottom: 5px;
      font-size: 9px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .statement-client {
      max-width: 220px;
      font-size: 13px;
      font-weight: 800;
      color: #111827;
      line-height: 1.35;
    }

    .statement-meta-right {
      border-left: 1px solid #d1d5db;
      padding-left: 18px;
    }

    .statement-meta-row {
      display: grid;
      grid-template-columns: 100px 1fr;
      gap: 8px;
      padding: 2px 0;
      align-items: start;
    }

    .statement-meta-label {
      font-weight: 700;
      color: #64748b;
    }

    .statement-meta-right .statement-meta-row span:last-child {
      font-weight: 600;
      color: #111827;
    }

    .statement-meta-right .statement-meta-row:first-child span:last-child {
      white-space: nowrap;
    }

    .statement-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 24px;
      margin-bottom: 0;
      padding-bottom: 12px;
      border-bottom: 2px solid #0f4c6e;
      text-align: left;
    }

    .statement-header-left {
      min-width: 0;
    }

    .statement-kicker {
      margin-bottom: 4px;
      font-size: 9px;
      font-weight: 800;
      color: #0f4c6e;
      letter-spacing: 0.14em;
    }

    .nextmile-red {
      color: #dc2626;
    }

    .trucking-black {
      color: #111827;
    }

    .statement-title {
      font-size: 21px;
      font-weight: 800;
      color: #111827;
      line-height: 1.15;
    }

    .statement-generated {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      padding-right: 4px;
      font-size: 9px;
      color: #475569;
      white-space: nowrap;
      box-sizing: border-box;
    }

    .statement-generated-label {
      font-size: 8px;
      font-weight: 800;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
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

      .summary-grid,
      .statement-meta,
      .statement-ending,
      .statement-total {
        break-inside: avoid;
      }

      thead {
        display: table-header-group;
      }

      tfoot {
        display: table-footer-group;
      }

      tr {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .statement-total {
        break-before: avoid;
        page-break-before: avoid;
      }

      .statement-ending {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .nothing-follows {
        break-before: avoid;
        page-break-before: avoid;
      }

      .statement-page-footer {
        display: none;
      }

      @media print {
        .client-mode {
          padding-bottom: 10mm;
        }

        .client-mode .statement-page-footer {
          display: block;
          position: fixed;
          right: 2mm;
          bottom: 2mm;
          z-index: 9999;
          font-size: 8px;
          font-weight: 600;
          line-height: 1;
          color: #b0b7c0;
          letter-spacing: 0.04em;
          text-align: right;
          white-space: nowrap;
        }
      }

      .account-summary-title {
        width: 100%;
        box-sizing: border-box;
        background: #0f4c6e;
        color: #ffffff;
        padding: 7px 9px;
        font-size: 9px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .client-mode .summary-grid {
        grid-template-columns: 1fr;
        gap: 0;
      }

      .client-mode .summary-card {
        border: none;
        border-radius: 0;
        padding: 0;
        background: transparent;
        height: auto;
      }

      .client-mode .summary-row {
        padding: 5px 10px;
        border-bottom: 1px solid #e5e7eb;
        font-size: 10.5px;
      }

      .client-mode .summary-row:last-child {
        margin-top: 2px;
        padding-top: 7px;
        padding-bottom: 7px;
        border-top: 2px solid #0f4c6e;
        border-bottom: 2px solid #0f4c6e;
      }

      .client-mode .summary-row:last-child .summary-label,
      .client-mode .summary-row:last-child .summary-value {
        font-size: 13px;
        font-weight: 800;
      }
    }



    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      align-items: stretch;
      margin-bottom: 14px;
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
      height: 100%; /* ✅ equal height without flex */
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
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
      margin: 32px 0 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .client-mode .section-title {
      margin: 24px 0 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid #cbd5e1;
      font-size: 10px;
      color: #334155;
      letter-spacing: 0.08em;
    }

    .table-wrap {
      width: 100%;
      margin-top: 10px;
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
    }

    .date-col {
      white-space: nowrap;
      min-width: 100px;
      text-align: right;
    }
    .shipment-col {
      text-align: center;
    }
      
    .amount-col {
      text-align: right;
    }

    .client-mode .statement-table th,
    .client-mode .statement-table td {
      font-size: 10.5px;
    }

    .client-mode .statement-table thead th {
      padding: 8px;
      font-size: 9px;
      font-weight: 800;
      color: #ffffff;
      background: #0f4c6e;
      border-bottom: none;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .client-mode .statement-table tbody td {
      padding: 8px;
      border-bottom: 1px solid #e5e7eb;
      vertical-align: middle;
    }

    .client-mode .statement-table tbody tr:nth-child(even) td {
      background: #f8fafc;
    }

    .client-mode .statement-table tbody tr:last-child td {
      border-bottom: 2px solid #0f4c6e;
    }

    .client-mode .statement-table .date-col {
      text-align: right;
      white-space: nowrap;
      min-width: 0;
    }

    .statement-total {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 28px;
      margin-top: 14px;
      padding: 10px 12px;
      border-top: 2px solid #0f4c6e;
      border-bottom: 2px solid #0f4c6e;
      font-size: 12px;
    }

    .statement-total-label {
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    .statement-total-value {
      min-width: 130px;
      text-align: right;
      font-size: 15px;
      font-weight: 800;
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
<body class="${clientMode ? "client-mode" : "internal-mode"}">
  ${
    clientMode
      ? `
  <div class="statement-header">
    <div class="statement-header-left">
      <div class="statement-kicker">
        <span class="nextmile-red">NEXTMILE</span>
        <span class="trucking-black">TRUCKING SERVICES</span>
      </div>
      <div class="statement-title">
        Statement for ${escHtml(truckLabel)}
      </div>
    </div>

    <div class="statement-generated">
      <span class="statement-generated-label">Generated</span>
      <span>${formatStatementGenerated(new Date())}</span>
    </div>
  </div>

  <div class="statement-info-grid">
    <div class="statement-info-left">
      ${
        billingType === "subcontracted"
          ? `
            <div class="statement-meta-heading">BILLED TO</div>
            <div class="statement-client">${escHtml(billedTo || "—")}</div>

            <div style="margin-top:12px;">
              <div class="statement-meta-heading">CLIENT</div>
              <div class="statement-client">${escHtml(clientName || "—")}</div>
            </div>
          `
          : `
            <div class="statement-meta-heading">BILLED TO</div>
            <div class="statement-client">${escHtml(clientName || "—")}</div>
          `
      }

      <div class="statement-details">
        <div class="statement-detail-row">
          <span class="statement-meta-label">Statement No.</span>
          <span>${escHtml(statementNumber)}</span>
        </div>

        <div class="statement-detail-row">
          <span class="statement-meta-label">Statement Period</span>
          <span>${escHtml(statementPeriod)}</span>
        </div>
      </div>
    </div>

    <div class="statement-info-right">
      <div class="account-summary-title">
        STATEMENT SUMMARY
      </div>

      <div class="client-account-summary">
        <div class="summary-row">
          <span class="summary-label">Total Trips</span>
          <span class="summary-value">${totalTrips.toLocaleString()}</span>
        </div>

        <div class="summary-row">
          <span class="summary-label">Gross Income</span>
          <span class="summary-value">${peso(totalGross)}</span>
        </div>

        <div class="summary-row">
          <span class="summary-label">Parking / Passway</span>
          <span class="summary-value">${peso(parkingPasswayTotal)}</span>
        </div>

        <div class="summary-row">
          <span class="summary-label">Less: VAT</span>
          <span class="summary-value">${peso(totalVat)}</span>
        </div>

        ${
          deductFuel
            ? `
        <div class="summary-row">
          <span class="summary-label">Less: Diesel</span>
          <span class="summary-value">${peso(fuelTotal)}</span>
        </div>
        `
            : ""
        }

        <div class="summary-row statement-payable-row">
          <span class="summary-label">TOTAL PAYABLE</span>
          <span class="summary-value">${peso(totalReceivable)}</span>
        </div>
      </div>
    </div>
  </div>
  `
      : `
  <div class="header">
    <div class="title">Monthly Report for ${escHtml(truckLabel)}</div>
    <div class="subtitle">
      <strong>Period:</strong> ${escHtml(rangeLabel)}<br>
      <strong>Generated:</strong> ${formatDateTime(new Date())}
    </div>
  </div>
  `
  }

  <div class="summary-grid ${clientMode ? "client-summary-hidden" : ""}">
    <div class="summary-card">
      <div class="summary-row">
        <span class="summary-label">Total Trips</span>
        <span class="summary-value">${totalTrips.toLocaleString()}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Gross Income</span>
        <span class="summary-value">${peso(totalGross)}</span>
      </div>
      ${
        !clientMode
          ? `
      <div class="summary-row">
        <span class="summary-label">Total Crew Salary</span>
        <span class="summary-value">${peso(totalCrewSalary)}</span>
      </div>
      `
          : ""
      }
      ${
        clientMode
          ? `
      <div class="summary-row">
        <span class="summary-label">Parking / Passway</span>
        <span class="summary-value">${peso(parkingPasswayTotal)}</span>
      </div>
      `
          : ""
      }
      ${
        clientMode && deductFuel
          ? `
      <div class="summary-row">
        <span class="summary-label">Less: Diesel</span>
        <span class="summary-value">${peso(fuelTotal)}</span>
      </div>
      `
          : ""
      }
      <div class="summary-row">
        <span class="summary-label">Less: Total VAT</span>
        <span class="summary-value">${peso(totalVat)}</span>
      </div>
      ${
        clientMode
          ? `
      <div class="summary-row">
        <span class="summary-label">TOTAL PAYABLE</span>
        <span class="summary-value">${peso(totalReceivable)}</span>
      </div>
      `
          : ""
      }
      ${
        !clientMode
          ? `
      <div class="summary-row">
        <span class="summary-label">Total Expenses</span>
        <span class="summary-value">${peso(totalExpenses)}</span>
      </div>
      `
          : ""
      }
      ${
        !clientMode
          ? `
      <div class="summary-row">
        <span class="summary-label">Net Income</span>
        <span class="summary-value">${peso(totalNet)}</span>
      </div>
      `
          : ""
      }
    </div>

    ${
      !clientMode
        ? `
    <div class="summary-card">
      <div class="summary-row">
        <span class="summary-label">Expense Ratio</span>
        <span class="summary-value">${expenseRatio}%</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Crew Cost Ratio</span>
        <span class="summary-value">${crewCostRatio}%</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Net Margin</span>
        <span class="summary-value">${netMargin}%</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Avg per Trip</span>
        <span class="summary-value">${peso(avgPerTrip)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Profit per Trip</span>
        <span class="summary-value">${peso(profitPerTrip)}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Break-even per Trip</span>
        <span class="summary-value">${peso(breakEvenPerTrip)}</span>
      </div>

      <div style="margin-top:10px;padding-top:8px;border-top:1px solid #e5e7eb;font-size:9px;color:#9ca3af;line-height:1.4;">
        <div><strong>Formulas:</strong></div>
        <div>Expense Ratio = Expenses / Gross × 100</div>
        <div>Crew Cost Ratio = Crew Salary / Gross × 100</div>
        <div>Net Margin = Net Income / Gross × 100</div>
        <div>Avg per Trip = Gross / Total Trips</div>
        <div>Profit per Trip = Net Income / Total Trips</div>
        <div>Break-even per Trip = (Crew Salary + Expenses) / Total Trips</div>
      </div>
    </div>
    `
        : ""
    }

    ${
      !clientMode
        ? `
    <div class="summary-card">
      <div class="section-title" style="margin-top:4px;margin-bottom:2px;">
        Expense Breakdown
      </div>
      <div style="font-size:11px;color:#6b7280;margin-bottom:8px;">
        Distribution by category
      </div>
      ${expenseBreakdownHtml}
    </div>
    `
        : ""
    }
  </div>

  <div class="section-title">
    ${clientMode ? "STATEMENT DETAILS" : "Detailed Report"}
  </div>

  <div class="table-wrap">
    ${
      clientMode
        ? `
    <table class="statement-table">
      <colgroup>
        <col style="width:18%">
        <col style="width:28%">
        <col style="width:18%">
        <col style="width:18%">
        <col style="width:18%">
      </colgroup>

      <thead>
        <tr>
          <th class="date-col">Date</th>
          <th class="shipment-col">${labels.shipmentNumber}</th>
          <th class="amount-col">Rate</th>
          <th class="amount-col">VAT</th>
          <th class="amount-col">Gross</th>
        </tr>
      </thead>

      <tbody>
        ${
          clientRowHtml ||
          '<tr><td colspan="5" style="text-align:center;color:#999;padding:20px">No Records</td></tr>'
        }
      </tbody>
    </table>
    `
        : `
    <table>
      <colgroup>
        <col style="width:8%">
        <col style="width:10%">
        <col style="width:7%">
        <col style="width:6%">
        <col style="width:7%">
        <col style="width:7%">
        <col style="width:7%">
        <col style="width:7%">
        <col style="width:23%">
        <col style="width:6%">
        <col style="width:7%">
      </colgroup>

      <thead>
        <tr>
          <th class="date-col">Date</th>
          <th class="shipment-col">${labels.shipmentNumber}</th>
          <th>Rate</th>
          <th>VAT</th>
          <th>Crew Salary</th>
          <th>${labels.cashAdvance}</th>
          <th>Reimb</th>
          <th>Expenses</th>
          <th class="expense-breakdown">Expense Breakdown</th>
          <th>Gross</th>
          <th>Net</th>
        </tr>
      </thead>

      <tbody>
        ${
          rowHtml ||
          '<tr><td colspan="11" style="text-align:center;color:#999;padding:20px">No rows</td></tr>'
        }
      </tbody>
    </table>
    `
    }
  </div>

  <div class="nothing-follows">
    ${clientMode ? "— END OF STATEMENT —" : "— END OF REPORT —"}
  </div>

  ${
    clientMode
      ? `
  <div class="statement-page-footer">
    ${escHtml(statementNumber)}
  </div>
  `
      : ""
  }

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
export function exportClientMonthlyReport(
  rows: TripRow[],
  truckLabel: string,
  periodText: string,
  expenseRows: { category?: string; amount?: number }[] = [],
  deductFuel = false,
  clientName = "",
  billedTo = "",
  billingType: "subcontracted" | "direct" = "subcontracted",
) {
  return exportMonthlyReport(
    rows,
    truckLabel,
    periodText,
    expenseRows,
    true,
    deductFuel,
    clientName,
    billedTo,
    billingType,
  );
}
