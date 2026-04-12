import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import FilterBar from '../components/shared/FilterBar';
import TripTable from '../components/shared/TripTable';
import ExpenseBreakdownModal from '../components/shared/ExpenseBreakdownModal';
import { exportMonthlyReport } from '../lib/exportHelpers';
import { Download, BarChart3 } from 'lucide-react';
import Pagination from '../components/shared/Pagination';
import { usePagination } from '../hooks/usePagination';
import EmptyState from '../components/shared/EmptyState';

export default function ReportsPage() {
  const { reportRows, reportsMonth, setReportsMonth, fetchReports, initApp, selectedTruck, truckOptions } = useAppStore();
  const [expenseBreakdown, setExpenseBreakdown] = useState<{truckId: string; dateIso: string; dateText: string} | null>(null);

  useEffect(() => { initApp(); }, [initApp]);
  useEffect(() => { fetchReports(); }, [fetchReports, reportsMonth, selectedTruck]);

  const selectedTruckName = truckOptions.find((t) => t._id === selectedTruck)?.truckName;

  // Sorting state
  const [sortField, setSortField] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleSort = useCallback((field: string) => {
    setSortDirection((prev) => (sortField === field ? (prev === 'asc' ? 'desc' : 'asc') : 'asc'));
    setSortField(field);
  }, [sortField]);

  const sortedRows = useMemo(() => {
    if (!sortField) return reportRows;
    return [...reportRows].sort((a, b) => {
      const aVal = (a as unknown as Record<string, number | string>)[sortField] ?? 0;
      const bVal = (b as unknown as Record<string, number | string>)[sortField] ?? 0;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [reportRows, sortField, sortDirection]);

  const { paginatedItems: paginatedReports, currentPage, totalPages, totalItems, pageSize, handlePageChange, handlePageSizeChange } = usePagination(sortedRows, 20);

  const pageTitle = selectedTruckName ? `${selectedTruckName} Reports` : 'Reports';

  const handleDownloadReport = () => {
    const truckLabel = selectedTruckName || 'All Trucks';
    const monthNames: Record<string, string> = { ALL: 'Whole Year', '1': 'January', '2': 'February', '3': 'March', '4': 'April', '5': 'May', '6': 'June', '7': 'July', '8': 'August', '9': 'September', '10': 'October', '11': 'November', '12': 'December' };
    const year = new Date().getFullYear();
    const reportMonth = monthNames[reportsMonth] || 'Whole Year';
    const periodText = reportsMonth === 'ALL' ? `WHOLE YEAR ${year}` : `${reportMonth.toUpperCase()} ${year}`;
    exportMonthlyReport(reportRows, truckLabel, periodText);
  };

  return (
    <div>
      <div className="glass-card rounded-[28px] border border-slate-200/80 dark:border-slate-700/90 shadow-lg p-5 mb-3.5">
        <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
          <div>
            <h1 className="text-[1.45rem] font-bold tracking-tight">{pageTitle}</h1>
            <p className="text-sm text-slate-500 mt-1">Monthly report view using the same table columns.</p>
          </div>
          <div className="text-right">
            <div className="text-[0.72rem] font-bold tracking-wider uppercase text-slate-500">Reports view</div>
            <div className="font-bold text-sm">Monthly filtering</div>
          </div>
        </div>
      </div>

      <FilterBar showRange={false} showTruck={false} showMonth monthValue={reportsMonth} onMonthChange={setReportsMonth}
        actions={<button onClick={handleDownloadReport} className="min-h-[44px] px-4 rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors flex items-center gap-1.5"><Download size={16} /> Download Report</button>} />

      <div className="glass-card rounded-[22px] border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-3.5 overflow-hidden">
        <div className="mb-3">
          <h2 className="text-base font-bold tracking-tight">MONTHLY REPORTS</h2>
          <p className="text-sm text-slate-500">Same columns as the trip table, filtered by month.</p>
        </div>
        <TripTable
          rows={paginatedReports}
          loading={false}
          showActions={false}
          reportMode
          showTruckColumn={!selectedTruck}
          sortable
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onExpenseClick={(data) => setExpenseBreakdown(data)}
          selectedTruck={selectedTruck}
          emptyState={
            <EmptyState
              icon={BarChart3}
              title="No report data"
              description={selectedTruck
                ? `No trip records found for ${selectedTruckName} in the selected period.`
                : "Select a truck and month to generate a report."
              }
            />
          }
        />
        <Pagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={handlePageChange} onPageSizeChange={handlePageSizeChange} />
      </div>

      {/* Expense Breakdown Modal */}
      <ExpenseBreakdownModal
        open={!!expenseBreakdown}
        onClose={() => setExpenseBreakdown(null)}
        truckId={expenseBreakdown?.truckId || ''}
        dateIso={expenseBreakdown?.dateIso || ''}
        dateText={expenseBreakdown?.dateText || ''}
      />
    </div>
  );
}
