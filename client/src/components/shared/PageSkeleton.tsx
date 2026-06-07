import { SkeletonPageHeader, SkeletonKpiCard } from './Skeleton';

export default function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <SkeletonPageHeader />
      
      {/* Filter bar skeleton */}
      <div className="glass-card rounded-[22px] border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-4 mb-3.5">
        <div className="flex gap-3">
          <div className="h-[44px] w-[180px] bg-slate-200 dark:bg-slate-700 rounded-[14px]" />
          <div className="h-[44px] w-[180px] bg-slate-200 dark:bg-slate-700 rounded-[14px]" />
          <div className="h-[44px] flex-1 bg-slate-200 dark:bg-slate-700 rounded-[14px]" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonKpiCard key={i} />
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="glass-card rounded-[22px] border border-slate-200/90 dark:border-slate-700/90 shadow-sm p-3.5">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-700 rounded mb-3" />
        <div className="h-[400px] w-full bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
    </div>
  );
}
