import TablePagination from "@mui/material/TablePagination";
import { useState, type ReactElement } from "react";

export const tablePageSize = 10;

type TablePaginationBarProps = {
  count: number;
  page: number;
  onPageChange: (page: number) => void;
};

type TablePage = {
  page: number;
  setPage: (page: number) => void;
};

export function useTablePage(listKey: string, count: number): TablePage {
  const [page, setPage] = useState(0);
  const [pageListKey, setPageListKey] = useState(listKey);
  const maxPage = Math.max(0, Math.ceil(count / tablePageSize) - 1);

  if (pageListKey !== listKey) {
    setPageListKey(listKey);
    setPage(0);
  } else if (page > maxPage) {
    setPage(maxPage);
  }

  const currentPage = pageListKey !== listKey ? 0 : Math.min(page, maxPage);

  return { page: currentPage, setPage };
}

export function TablePaginationBar({
  count,
  page,
  onPageChange,
}: TablePaginationBarProps): ReactElement {
  return (
    <TablePagination
      component="div"
      count={count}
      page={page}
      onPageChange={(_event, nextPage) => {
        onPageChange(nextPage);
      }}
      rowsPerPage={tablePageSize}
      rowsPerPageOptions={[tablePageSize]}
      sx={{ borderTop: 1, borderColor: "divider" }}
    />
  );
}
