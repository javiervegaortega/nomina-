import { useState, useMemo } from 'react';

export default function usePagination(data, initialLimit = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  const safeData = Array.isArray(data) ? data : [];
  const totalItems = safeData.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Ensure current page is valid when data changes or limit changes
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  
  if (validCurrentPage !== currentPage) {
    setCurrentPage(validCurrentPage);
  }

  const paginatedData = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * limit;
    const endIndex = startIndex + limit;
    return safeData.slice(startIndex, endIndex);
  }, [safeData, validCurrentPage, limit]);

  const goToNextPage = () => {
    setCurrentPage((page) => Math.min(page + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage((page) => Math.max(page - 1, 1));
  };

  const changeLimit = (newLimit) => {
    setLimit(newLimit);
    setCurrentPage(1); // Reset to first page when limit changes
  };

  return {
    paginatedData,
    currentPage: validCurrentPage,
    totalPages,
    totalItems,
    limit,
    goToNextPage,
    goToPreviousPage,
    changeLimit
  };
}
