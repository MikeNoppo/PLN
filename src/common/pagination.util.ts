export interface PaginationMeta {
  totalItems: number;
  itemCount: number;
  itemsPerPage: number;
  totalPages: number;
  currentPage: number;
}

export function paginate<T>(allData: T[], page: number = 1, limit: number = 10) {
  const skip = (page - 1) * limit;
  const paginated = allData.slice(skip, skip + limit);
  const totalItems = allData.length;
  const meta: PaginationMeta = {
    totalItems,
    itemCount: paginated.length,
    itemsPerPage: limit,
    totalPages: Math.ceil(totalItems / limit),
    currentPage: page,
  };
  return { data: paginated, meta };
}
