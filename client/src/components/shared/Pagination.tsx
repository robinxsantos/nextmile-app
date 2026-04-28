import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "../../lib/utils";
import Select from "react-select";
import { useAppStore } from "../../store/useAppStore";
import { getMiniSelectStyles } from "../../lib/selectStyles";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [
  { value: 10, label: "10 / page" },
  { value: 20, label: "20 / page" },
  { value: 50, label: "50 / page" },
  { value: 100, label: "100 / page" },
];

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const { theme } = useAppStore();
  const isDark = theme === "dark";
  const miniStyles = getMiniSelectStyles(isDark);

  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push("...");
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const btnBase =
    "h-9 min-w-[36px] rounded-md inline-flex items-center justify-center text-sm font-medium transition-colors";
  const btnInactive =
    "text-muted-foreground hover:bg-muted border border-transparent";
  const btnActive = "bg-foreground text-background";
  const btnDisabled = "opacity-30 pointer-events-none";

  return (
    <div className="w-full px-4 py-3 grid grid-cols-[auto_1fr_auto] items-center">
      {/* LEFT: TEXT */}
      <div className="flex items-center gap-3 text-sm text-muted-foreground">
        <span>
          Showing{" "}
          <span className="font-semibold text-foreground">
            {startItem}-{endItem}
          </span>{" "}
          of <span className="font-semibold text-foreground">{totalItems}</span>
        </span>

        {onPageSizeChange && (
          <div className="min-w-[120px]">
            <Select
              options={PAGE_SIZE_OPTIONS}
              value={PAGE_SIZE_OPTIONS.find((o) => o.value === pageSize)}
              onChange={(opt) => {
                if (opt) onPageSizeChange(opt.value);
              }}
              styles={{
                ...miniStyles,
                menuPortal: (base: Record<string, unknown>) => ({
                  ...base,
                  zIndex: 9999,
                }),
              }}
              isSearchable={false}
              menuPortalTarget={document.body}
              classNamePrefix="nm-select"
              menuPlacement="top"
            />
          </div>
        )}
      </div>

      {/* CENTER SPACER (ITO YUNG KULANG MO) */}
      <div />

      {/* RIGHT: BUTTONS */}
      <div className="flex items-center gap-1 justify-self-end">
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          className={cn(btnBase, btnInactive, currentPage === 1 && btnDisabled)}
          title="First"
        >
          <ChevronsLeft size={16} />
        </button>

        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={cn(btnBase, btnInactive, currentPage === 1 && btnDisabled)}
          title="Previous"
        >
          <ChevronLeft size={16} />
        </button>

        {getPageNumbers().map((p, i) =>
          p === "..." ? (
            <span
              key={`dot-${i}`}
              className="h-9 min-w-[36px] inline-flex items-center justify-center text-slate-400 text-sm"
            >
              ···
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                btnBase,
                p === currentPage ? btnActive : btnInactive,
              )}
            >
              {p}
            </button>
          ),
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={cn(
            btnBase,
            btnInactive,
            currentPage === totalPages && btnDisabled,
          )}
          title="Next"
        >
          <ChevronRight size={16} />
        </button>

        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          className={cn(
            btnBase,
            btnInactive,
            currentPage === totalPages && btnDisabled,
          )}
          title="Last"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}
