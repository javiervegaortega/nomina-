const PAGE_SIZES = new Set([10, 25, 50, 100]);

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const getPagination = (query = {}, defaultPageSize = 25) => {
  const requested = parsePositiveInt(query.pageSize || query.limit, defaultPageSize);
  const pageSize = PAGE_SIZES.has(requested) ? requested : defaultPageSize;
  const page = parsePositiveInt(query.page, 1);
  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize
  };
};

const toPagedResponse = (rows, count, page, pageSize) => ({
  items: rows,
  pagination: {
    page,
    pageSize,
    total: Number(count) || 0,
    totalPages: Math.max(1, Math.ceil((Number(count) || 0) / pageSize))
  }
});

const wantsPagination = (query = {}) => (
  query.page !== undefined
  || query.pageSize !== undefined
  || query.limit !== undefined
);

module.exports = {
  getPagination,
  toPagedResponse,
  wantsPagination
};
