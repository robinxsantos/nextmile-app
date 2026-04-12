import { useState } from 'react';

export function usePagination<T>(items: T[], initialPageSize: number = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginatedItems = items.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handlePageChange = (newPage: number) => {
    setPage(Math.max(1, Math.min(newPage, totalPages)));
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setPage(1);
  };

  // Reset to page 1 when items change significantly
  if (page > totalPages && totalPages > 0) {
    setPage(1);
  }

  return {
    paginatedItems,
    currentPage,
    totalPages,
    totalItems: items.length,
    pageSize,
    handlePageChange,
    handlePageSizeChange,
  };
}
