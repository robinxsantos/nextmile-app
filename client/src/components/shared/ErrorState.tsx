import { AlertTriangle, RotateCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="w-16 h-16 rounded-full bg-red-500/10 grid place-items-center mb-4">
        <AlertTriangle size={32} className="text-red-500" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-2">{title}</h3>
      <p className="text-sm text-slate-500 dark:text-slate-400 text-center mb-6 max-w-md">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-[14px] bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <RotateCw size={16} />
          Try Again
        </button>
      )}
    </div>
  );
}
