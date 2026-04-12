import { useState, useEffect } from 'react';
import { Keyboard, X } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

const adminShortcuts = [
  { keys: ['/', '⌘K'], description: 'Focus search' },
  { keys: ['N'], description: 'New trip' },
  { keys: ['E'], description: 'New expense' },
  { keys: ['1'], description: 'Go to Dashboard' },
  { keys: ['2'], description: 'Go to Trips' },
  { keys: ['3'], description: 'Go to Expenses' },
  { keys: ['4'], description: 'Go to Reports' },
  { keys: ['5'], description: 'Go to Payments' },
  { keys: ['6'], description: 'Go to Trucks' },
  { keys: ['7'], description: 'Go to Users' },
  { keys: ['Esc'], description: 'Close modal / dialog' },
  { keys: ['?'], description: 'Show this help' },
];

const employeeShortcuts = [
  { keys: ['/', '⌘K'], description: 'Focus search' },
  { keys: ['N'], description: 'New trip' },
  { keys: ['E'], description: 'New expense' },
  { keys: ['1'], description: 'Go to Trips' },
  { keys: ['2'], description: 'Go to Expenses' },
  { keys: ['Esc'], description: 'Close modal / dialog' },
  { keys: ['?'], description: 'Show this help' },
];

export default function KeyboardShortcutsHelp() {
  const { isAdmin } = useAuthStore();
  const shortcuts = isAdmin() ? adminShortcuts : employeeShortcuts;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
      if ((e.target as HTMLElement).isContentEditable) return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg grid place-items-center text-slate-500 dark:text-slate-400 hover:bg-blue-50 dark:hover:bg-slate-700 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:scale-105"
        title="Keyboard shortcuts (?)"
      >
        <Keyboard size={18} />
      </button>

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
          <div
            className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/10 dark:bg-blue-500/15 grid place-items-center text-blue-600 dark:text-blue-400">
                  <Keyboard size={16} />
                </div>
                <h3 className="font-bold text-base tracking-tight">Keyboard Shortcuts</h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 rounded-lg grid place-items-center text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Shortcuts list */}
            <div className="px-5 py-3 max-h-[60vh] overflow-y-auto">
              <div className="flex flex-col gap-0.5">
                {shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0"
                  >
                    <span className="text-sm text-slate-600 dark:text-slate-300">{shortcut.description}</span>
                    <div className="flex items-center gap-1.5">
                      {shortcut.keys.map((key) => (
                        <kbd
                          key={key}
                          className="inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 shadow-sm"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                Press <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[0.65rem] font-semibold">?</kbd> to toggle this help
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
