import { RotateCcw, CalendarDays } from "lucide-react";
import { useAppStore } from "../../store/useAppStore";
import type { RangePreset } from "../../lib/dateHelpers";
import type { DateRange } from "react-day-picker";
import { getSelectStyles } from "../../lib/selectStyles";
import { Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  { value: "ALL", label: "All Time" },
  { value: "CC", label: "This Cutoff" },
  { value: "LC", label: "Previous Cutoff" },
  { value: "TM", label: "This Month" },
  { value: "LM", label: "Last Month" },
  { value: "MTD", label: "Month to Date" },
  { value: "YTD", label: "Year to Date" },
  { value: "CUSTOM", label: "Custom Range" },
] as const;

const MONTHS = [
  { value: "ALL", label: "Whole Year" },
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
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
  const [openMonth, setOpenMonth] = useState(false);
  const [openTruck, setOpenTruck] = useState(false);
  const [openRange, setOpenRange] = useState(false);
  const parsedStart = startDate ? new Date(startDate) : null;
  const parsedEnd = endDate ? new Date(endDate) : null;
  const [openRangePreset, setOpenRangePreset] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: parsedStart || undefined,
    to: parsedEnd || undefined,
  });

  useEffect(() => {
    if (startDate && endDate) {
      setDateRange({
        from: new Date(startDate),
        to: new Date(endDate),
      });
    } else {
      setDateRange(undefined);
    }
  }, [startDate, endDate]);

  const isDark = theme === "dark";
  const styles = getSelectStyles(isDark);

  const rangeOptions = allowedRangePresets
    ? RANGE_OPTIONS.filter((option) =>
        allowedRangePresets.includes(option.value as RangePreset),
      )
    : RANGE_OPTIONS;

  const currentRangeOption =
    rangeOptions.find((o) => o.value === rangePreset) || rangeOptions[0];

  const truckSelectOptions = [
    { value: "", label: "All Trucks" },
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

  const handleReset = () => {
    const resetPreset = rangeOptions.some((option) => option.value === "ALL")
      ? "ALL"
      : rangeOptions[0]?.value || "ALL";
    setRangePreset(resetPreset as RangePreset);
    setStartDate("");
    setEndDate("");
    if (!showMonth) {
      setTimeout(() => {
        fetchDashboard();
        fetchExpenses();
      }, 0);
    }
  };

  return (
    <div className="border rounded-lg p-4 bg-background">
      <div className="flex flex-wrap gap-3 items-end">
        {showRange && (
          <div className="min-w-[180px] flex-1 max-w-[220px]">
            <label className="text-[0.72rem] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
              Date Range
            </label>

            <Popover open={openRangePreset} onOpenChange={setOpenRangePreset}>
              <PopoverTrigger asChild>
                <button
                  role="combobox"
                  className="w-full h-[44px] justify-between rounded-md border border-border bg-background px-3 text-sm flex items-center"
                >
                  {rangeOptions.find((o) => o.value === rangePreset)?.label ||
                    "Select range"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search range..." />
                  <CommandEmpty>No results found.</CommandEmpty>

                  <CommandGroup>
                    {rangeOptions.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.label}
                        onSelect={() => {
                          setRangePreset(opt.value as RangePreset);

                          setTimeout(() => {
                            fetchDashboard();
                            fetchExpenses();
                          }, 0);

                          setOpenRangePreset(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            rangePreset === opt.value
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {showTruck && (
          <div className="min-w-[180px] flex-1 max-w-[220px]">
            <label className="text-[0.72rem] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
              Truck
            </label>
            <Popover open={openTruck} onOpenChange={setOpenTruck}>
              <PopoverTrigger asChild>
                <button
                  role="combobox"
                  className="w-full h-[44px] justify-between rounded-md border border-border bg-background px-3 text-sm flex items-center"
                >
                  {truckSelectOptions.find((o) => o.value === selectedTruck)
                    ?.label || "Select truck"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search truck..." />
                  <CommandEmpty>No truck found.</CommandEmpty>

                  <CommandGroup>
                    {truckSelectOptions.map((t) => (
                      <CommandItem
                        key={t.value}
                        value={t.label}
                        onSelect={() => {
                          setSelectedTruck(t.value);
                          setTimeout(() => {
                            fetchDashboard();
                            fetchExpenses();
                          }, 0);
                          setOpenTruck(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            selectedTruck === t.value
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        {t.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {showRange && (
          <div className="min-w-[260px] flex-1 max-w-[320px]">
            <label className="text-[0.72rem] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
              <CalendarDays size={12} />
              Period
            </label>

            <Popover open={openRange} onOpenChange={setOpenRange}>
              <PopoverTrigger asChild>
                <button className="w-full h-[44px] justify-between rounded-md border border-border bg-background px-3 text-sm flex items-center">
                  {dateRange?.from && dateRange?.to
                    ? `${format(dateRange!.from, "MMM d, yyyy")} - ${format(dateRange!.to, "MMM d, yyyy")}`
                    : "Select date range"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    setDateRange(range);

                    if (range?.from && range?.to && range.from !== range.to) {
                      setStartDate(format(range.from, "yyyy-MM-dd"));
                      setEndDate(format(range.to, "yyyy-MM-dd"));
                      setRangePreset("CUSTOM");

                      setTimeout(() => {
                        fetchDashboard();
                        fetchExpenses();
                      }, 0);
                    }
                  }}
                  numberOfMonths={2}
                  defaultMonth={dateRange?.from}
                  showOutsideDays
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        {showMonth && (
          <div className="min-w-[180px] flex-1 max-w-[220px]">
            <label className="text-[0.72rem] font-bold tracking-wider uppercase text-muted-foreground mb-1.5 block">
              Range
            </label>

            <Popover open={openMonth} onOpenChange={setOpenMonth}>
              <PopoverTrigger asChild>
                <button
                  role="combobox"
                  className="w-full h-[44px] justify-between rounded-md border border-border bg-background px-3 text-sm flex items-center"
                >
                  {MONTHS.find((m) => m.value === (monthValue || "ALL"))
                    ?.label || "Select month"}
                  <ChevronsUpDown className="ml-2 h-4 w-4 opacity-50" />
                </button>
              </PopoverTrigger>

              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search month..." />
                  <CommandEmpty>No results found.</CommandEmpty>

                  <CommandGroup>
                    {MONTHS.map((m) => (
                      <CommandItem
                        key={m.value}
                        value={m.label}
                        onSelect={() => {
                          onMonthChange?.(m.value);
                          setOpenMonth(false);
                        }}
                      >
                        <Check
                          className={`mr-2 h-4 w-4 ${
                            (monthValue || "ALL") === m.value
                              ? "opacity-100"
                              : "opacity-0"
                          }`}
                        />
                        {m.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {showRange && (
          <button
            onClick={handleReset}
            className="h-[44px] px-4 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
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
