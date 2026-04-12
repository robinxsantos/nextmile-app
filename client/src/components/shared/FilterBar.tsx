import { RotateCcw, CalendarDays } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { RangePreset } from '../../lib/dateHelpers';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import { getSelectStyles } from '../../lib/selectStyles';
import 'react-datepicker/dist/react-datepicker.css';

interface FilterBarProps {
  showTruck?: boolean;
  showRange?: boolean;
  showMonth?: boolean;
  monthValue?: string;
  onMonthChange?: (val: string) => void;
  actions?: React.ReactNode;
  allowedRangePresets?: readonly RangePreset[];
}

const RANGE_OPTIONS = [
  { value: 'ALL', label: 'All Time' },
  { value: 'CC', label: 'Current Cutoff' },
  { value: 'LC', label: 'Last Cutoff' },
  { value: 'TM', label: 'This Month' },
  { value: 'LM', label: 'Last Month' },
  { value: 'MTD', label: 'Month to Date' },
  { value: 'YTD', label: 'Year to Date' },
  { value: 'CUSTOM', label: 'Custom Range' },
] as const;

const MONTHS = [
  { value: 'ALL', label: 'Whole Year' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

export default function FilterBar({
  showTruck = true,
  showRange = true,
  showMonth = false,
  monthValue,
  onMonthChange,
  actions,
  allowedRangePresets,
}: FilterBarProps) {
  const {
    truckOptions,
    selectedTruck,
    setSelectedTruck,
    rangePreset,
    setRangePreset,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    fetchDashboard,
    fetchExpenses,
    theme,
  } = useAppStore();

  const isDark = theme === 'dark';
  const styles = getSelectStyles(isDark);

  const rangeOptions = allowedRangePresets
    ? RANGE_OPTIONS.filter((option) => allowedRangePresets.includes(option.value as RangePreset))
    : RANGE_OPTIONS;

  const currentRangeOption = rangeOptions.find((o) => o.value === rangePreset) || rangeOptions[0];

  const truckSelectOptions = [
    { value: '', label: 'All Trucks' },
    ...truckOptions.map((t) => ({ value: t._id, label: t.truckName })),
  ];

  const handleRangeChange = (option: { value: string } | null) => {
    if (!option) return;
    setRangePreset(option.value as RangePreset);
    setTimeout(() => {
      fetchDashboard();
      fetchExpenses();
    }, 0);
  };

  const handleTruckChange = (option: { value: string } | null) => {
    if (!option) return;
    setSelectedTruck(option.value);
    setTimeout(() => {
      fetchDashboard();
      fetchExpenses();
    }, 0);
  };

  const handleDateRangeChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;
    setStartDate(
      start
        ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
        : '',
    );
    setEndDate(
      end
        ? `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`
        : '',
    );
    setRangePreset('CUSTOM');
    if (start && end) {
      setTimeout(() => {
        fetchDashboard();
        fetchExpenses();
      }, 0);
    }
  };

  const handleReset = () => {
    const resetPreset = rangeOptions.some((option) => option.value === 'ALL')
      ? 'ALL'
      : rangeOptions[0]?.value || 'ALL';
    setRangePreset(resetPreset as RangePreset);
    setStartDate('');
    setEndDate('');
    if (!showMonth) {
      setTimeout(() => {
        fetchDashboard();
        fetchExpenses();
      }, 0);
    }
  };

  const handleMonthChange = (option: { value: string } | null) => {
    if (!option) return;
    onMonthChange?.(option.value);
  };

  const parsedStart = startDate ? new Date(`${startDate}T00:00:00`) : null;
  const parsedEnd = endDate ? new Date(`${endDate}T00:00:00`) : null;

  return (
    <div className="glass-card rounded-[22px] border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-4 mb-3.5 relative z-20">
      <div className="flex flex-wrap gap-3 items-end">
        {showRange && (
          <div className="min-w-[180px] flex-1 max-w-[220px]">
            <label className="text-[0.72rem] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1.5 block">
              Date Range
            </label>
            <Select
              options={rangeOptions}
              value={currentRangeOption}
              onChange={handleRangeChange}
              styles={{
                ...styles,
                menuPortal: (base: Record<string, unknown>) => ({
                  ...base,
                  zIndex: 9999,
                }),
              }}
              isSearchable={false}
              menuPortalTarget={document.body}
              classNamePrefix="nm-select"
            />
          </div>
        )}

        {showTruck && (
          <div className="min-w-[180px] flex-1 max-w-[220px]">
            <label className="text-[0.72rem] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1.5 block">
              Truck
            </label>
            <Select
              options={truckSelectOptions}
              value={truckSelectOptions.find((o) => o.value === selectedTruck)}
              onChange={handleTruckChange}
              styles={{
                ...styles,
                menuPortal: (base: Record<string, unknown>) => ({
                  ...base,
                  zIndex: 9999,
                }),
              }}
              isSearchable
              menuPortalTarget={document.body}
              classNamePrefix="nm-select"
              placeholder="Select truck..."
            />
          </div>
        )}

        {showRange && (
          <div className="min-w-[260px] flex-1 max-w-[320px]">
            <label className="text-[0.72rem] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1">
              <CalendarDays size={12} />
              Period
            </label>
            <DatePicker
              selectsRange
              startDate={parsedStart}
              endDate={parsedEnd}
              onChange={handleDateRangeChange}
              dateFormat="MMM d, yyyy"
              placeholderText="Select date range..."
              className="w-full min-h-[44px] rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 px-3.5 text-sm focus:border-blue-400 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10 outline-none transition-colors cursor-pointer"
              wrapperClassName="w-full"
              isClearable
              showPopperArrow={false}
              monthsShown={2}
            />
          </div>
        )}

        {showMonth && (
          <div className="min-w-[180px] flex-1 max-w-[220px]">
            <label className="text-[0.72rem] font-bold tracking-wider uppercase text-slate-500 dark:text-slate-400 mb-1.5 block">
              Range
            </label>
            <Select
              options={MONTHS}
              value={MONTHS.find((m) => m.value === (monthValue || 'ALL'))}
              onChange={handleMonthChange}
              styles={{
                ...styles,
                menuPortal: (base: Record<string, unknown>) => ({
                  ...base,
                  zIndex: 9999,
                }),
              }}
              isSearchable={false}
              menuPortalTarget={document.body}
              classNamePrefix="nm-select"
            />
          </div>
        )}

        {showRange && (
          <button
            onClick={handleReset}
            className="min-h-[44px] px-4 rounded-[14px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-semibold text-sm hover:bg-blue-50 dark:hover:bg-blue-500/10 hover:border-blue-200 dark:hover:border-blue-500/30 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw size={16} />
            Reset
          </button>
        )}

        {actions && <div className="flex gap-2 ml-auto">{actions}</div>}
      </div>
    </div>
  );
}
