import { cn } from '../../lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse bg-slate-200 dark:bg-slate-700 rounded', className)} />
  );
}

export function SkeletonKpiCard() {
  return (
    <div className="relative p-[18px] min-h-[122px] rounded-[22px] bg-gradient-to-b from-white to-slate-50/95 dark:from-slate-900 dark:to-slate-800/90 border border-slate-200/90 dark:border-slate-700/90 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="w-[42px] h-[42px] rounded-[14px]" />
      </div>
      <Skeleton className="h-3 w-full mt-3" />
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="glass-card rounded-[22px] border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-[260px] w-full rounded-xl" />
    </div>
  );
}

export function SkeletonTableRow({ columns = 15 }: { columns?: number }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="text-center px-2.5 py-2.5 border-b border-slate-100 dark:border-slate-800">
          <Skeleton className="h-4 w-full mx-auto" />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="glass-card rounded-[28px] border border-slate-200/80 dark:border-slate-700/90 shadow-lg p-5 mb-3.5">
      <div className="flex flex-col md:flex-row justify-between md:items-end gap-3">
        <div className="flex-1">
          <Skeleton className="h-7 w-48 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="text-right">
          <Skeleton className="h-3 w-24 mb-1 ml-auto" />
          <Skeleton className="h-4 w-32 ml-auto" />
        </div>
      </div>
    </div>
  );
}
