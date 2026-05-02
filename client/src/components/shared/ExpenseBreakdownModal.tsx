import { useState, useEffect } from "react";
import { peso } from "../../lib/utils";
import api from "../../api/client";
import { Receipt } from "lucide-react";

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
  const [total, setTotal] = useState(0);
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
          setTotal(data.total || 0);
        }
      } catch {
        if (!cancelled) {
          setItems([]);
          setTotal(0);
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

  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        if (!val) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-[500px]"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Expense Breakdown – {dateText}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="text-center py-8 text-muted-foreground animate-pulse">
            Loading...
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8">
            <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-muted grid place-items-center text-muted-foreground">
              <Receipt size={24} />
            </div>
            <p className="text-sm text-muted-foreground">
              No expenses recorded for this date
            </p>
          </div>
        ) : (
          <div>
            {/* Items */}
            <div className="space-y-0">
              {items.map((item, i) => (
                <div
                  key={item._id}
                  className="flex items-center justify-between py-3.5 px-3 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 grid place-items-center flex-shrink-0 text-xs font-bold">
                      {i + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {item.category}
                      </div>

                      {item.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {item.description}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="text-sm font-bold text-red-500 ml-4 whitespace-nowrap">
                    {peso(item.amount)}
                  </div>
                </div>
              ))}
            </div>

            {/* Divider */}
            <div className="my-2 border-t-2 border-dashed border-border" />

            {/* Total */}
            <div className="flex items-center justify-between py-3 px-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted grid place-items-center">
                  <Receipt size={16} className="text-muted-foreground" />
                </div>

                <span className="text-sm font-bold">
                  Total ({items.length} {items.length === 1 ? "item" : "items"})
                </span>
              </div>

              <span className="text-base font-extrabold">{peso(total)}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
