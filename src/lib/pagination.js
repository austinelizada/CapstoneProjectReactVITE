export const paginateItems = (items = [], page = 1, pageSize = 8) => {
  const safeItems = Array.isArray(items) ? items : [];
  const safePage = Number.isFinite(Number(page)) ? Math.max(1, Number(page)) : 1;
  const safePageSize = Number.isFinite(Number(pageSize)) && Number(pageSize) > 0 ? Number(pageSize) : 8;
  const totalPages = Math.max(1, Math.ceil(safeItems.length / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = startIndex + safePageSize;

  return {
    items: safeItems.slice(startIndex, endIndex),
    currentPage,
    totalPages,
    totalItems: safeItems.length,
    startIndex,
    endIndex,
  };
};
