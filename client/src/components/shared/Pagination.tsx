import { ChevronsLeft, ChevronsRight } from "lucide-react";

import {
  Pagination as PaginationRoot,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
  if (totalItems === 0) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = () => {
    const pages: (number | "...")[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }

      return pages;
    }

    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3">
      {/* LEFT */}
      <div className="flex items-center gap-3">
        <p className="whitespace-nowrap text-xs text-muted-foreground">
          Showing{" "}
          <span className="font-medium text-foreground">
            {startItem}-{endItem}
          </span>{" "}
          of <span className="font-medium text-foreground">{totalItems}</span>
        </p>

        {onPageSizeChange && (
          <Select
            value={String(pageSize)}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          >
            <SelectTrigger size="sm" className="w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>

            <SelectContent position="popper" side="top" align="start">
              {PAGE_SIZE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={String(option.value)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div />

      {/* RIGHT */}
      <PaginationRoot className="mx-0 w-auto justify-end">
        <PaginationContent>
          {/* FIRST */}
          <PaginationItem>
            <PaginationLink
              href="#"
              size="icon"
              aria-label="Go to first page"
              aria-disabled={currentPage === 1}
              className={
                currentPage === 1 ? "pointer-events-none opacity-50" : undefined
              }
              onClick={(event) => {
                event.preventDefault();

                if (currentPage !== 1) {
                  onPageChange(1);
                }
              }}
            >
              <ChevronsLeft />
            </PaginationLink>
          </PaginationItem>

          {/* PREVIOUS */}
          <PaginationItem>
            <PaginationPrevious
              href="#"
              text=""
              size="icon"
              aria-disabled={currentPage === 1}
              className={
                currentPage === 1
                  ? "pointer-events-none p-0! opacity-50"
                  : "p-0!"
              }
              onClick={(event) => {
                event.preventDefault();

                if (currentPage > 1) {
                  onPageChange(currentPage - 1);
                }
              }}
            />
          </PaginationItem>

          {/* PAGES */}
          {getPageNumbers().map((page, index) =>
            page === "..." ? (
              <PaginationItem key={`ellipsis-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <PaginationLink
                  href="#"
                  isActive={page === currentPage}
                  onClick={(event) => {
                    event.preventDefault();
                    onPageChange(page);
                  }}
                >
                  {page}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          {/* NEXT */}
          <PaginationItem>
            <PaginationNext
              href="#"
              text=""
              size="icon"
              aria-disabled={currentPage === totalPages}
              className={
                currentPage === totalPages
                  ? "pointer-events-none p-0! opacity-50"
                  : "p-0!"
              }
              onClick={(event) => {
                event.preventDefault();

                if (currentPage < totalPages) {
                  onPageChange(currentPage + 1);
                }
              }}
            />
          </PaginationItem>

          {/* LAST */}
          <PaginationItem>
            <PaginationLink
              href="#"
              size="icon"
              aria-label="Go to last page"
              aria-disabled={currentPage === totalPages}
              className={
                currentPage === totalPages
                  ? "pointer-events-none opacity-50"
                  : undefined
              }
              onClick={(event) => {
                event.preventDefault();

                if (currentPage !== totalPages) {
                  onPageChange(totalPages);
                }
              }}
            >
              <ChevronsRight />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </PaginationRoot>
    </div>
  );
}
