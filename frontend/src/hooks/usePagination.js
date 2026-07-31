import { useState, useMemo } from 'react';

export default function usePagination(data, initialLimit = 10) {
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);

  const safeData = useMemo(() => (Array.isArray(data) ? data : []), [data]);
  const totalItems = safeData.length;
  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Ensure current page is valid when data changes or limit changes
  const validCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  
  const paginatedData = useMemo(() => {
    const startIndex = (validCurrentPage - 1) * limit;
    const endIndex = startIndex + limit;
    return safeData.slice(startIndex, endIndex);
  }, [safeData, validCurrentPage, limit]);

  const goToNextPage = () => {
    setCurrentPage(Math.min(validCurrentPage + 1, totalPages));
  };

  const goToPreviousPage = () => {
    setCurrentPage(Math.max(validCurrentPage - 1, 1));
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
