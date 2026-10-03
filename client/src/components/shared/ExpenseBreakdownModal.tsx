import { useState, useEffect } from "react";
import { cn } from "../../lib/utils";
import api from "../../api/client";
import { ReceiptText } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ExpenseItem {
  _id: string;
  category: string;
  description: string;
  amount: number;
  reimbursed: boolean;
  label: string;
}

interface ExpenseBreakdownModalProps {
  open: boolean;
  onClose: () => void;
  truckId: string;
  dateIso: string;
  dateText: string;
}

export default function ExpenseBreakdownModal({
  open,
  onClose,
  truckId,
  dateIso,
  dateText,
}: ExpenseBreakdownModalProps) {
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !truckId || !dateIso) return;

    let cancelled = false;

    const fetchExpenses = async () => {
      setLoading(true);
      try {
        const { data } = await api.get("/expenses/by-date", {
          params: { truck: truckId, date: dateIso },
        });

        if (!cancelled) {
          setItems(data.items || []);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchExpenses();

    return () => {
      cancelled = true;
    };
  }, [open, truckId, dateIso]);

  const effectiveTotal = items.reduce(
    (sum, item) => sum + (item.reimbursed ? 0 : Number(item.amount || 0)),
    0,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-[500px] gap-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Expense Breakdown – {dateText}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-md bg-muted">
              <ReceiptText className="size-4 text-muted-foreground" />
            </div>

            <p className="text-sm font-medium">No expenses found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              No expenses recorded for this date.
            </p>
          </div>
        ) : (
          <div>
            <div className="divide-y">
              {items.map((item) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between gap-4 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {item.category}
                    </p>

                    {(item.description || item.reimbursed) && (
                      <p className="truncate text-xs text-muted-foreground">
                        {item.description}
                        {item.reimbursed && (
                          <span className="text-green-600 dark:text-green-400">
                            {item.description ? " · " : ""}
                            Reimbursed by Client
                          </span>
                        )}
                      </p>
                    )}
                  </div>

                  <span
                    className={cn(
                      "shrink-0 text-sm font-medium tabular-nums",
                      item.reimbursed
                        ? "text-green-600 line-through dark:text-green-400"
                        : "text-destructive",
                    )}
                  >
                    <span className="inline-flex items-center">
                      {Number(item.amount || 0).toLocaleString("en-PH", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t pt-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  Effective Total ({items.length}{" "}
                  {items.length === 1 ? "item" : "items"})
                </span>
              </div>

              <span className="inline-flex items-center text-sm font-semibold tabular-nums">
                {Number(effectiveTotal || 0).toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
