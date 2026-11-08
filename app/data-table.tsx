"use client";

import Table, { type TableProps } from "@mui/material/Table";
import TableContainer from "@mui/material/TableContainer";
import MuiTableBody from "@mui/material/TableBody";
import { useId, useState, type ReactNode } from "react";

export { default as TableBody } from "@mui/material/TableBody";
export { default as TableCell } from "@mui/material/TableCell";
export { default as TableFooter } from "@mui/material/TableFooter";
export { default as TableHead } from "@mui/material/TableHead";
export { default as TableRow } from "@mui/material/TableRow";

export function PageControls({
  count,
  page,
  size,
  onPage,
  onSize,
  disabled = false,
}: {
  count: number;
  page: number;
  size: number;
  onPage: (page: number) => void;
  onSize: (size: number) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const pages = Math.max(1, Math.ceil(count / size));
  return (
    <div className="table-pagination" aria-label="Navigasi halaman data">
      <label htmlFor={id}>
        Baris per halaman
        <select
          id={id}
          value={size}
          disabled={disabled}
          onChange={(event) => onSize(Number(event.target.value))}
        >
          {[25, 50, 100].map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </label>
      <span role="status">
        {count ? page * size + 1 : 0}–{Math.min((page + 1) * size, count)} dari{" "}
        {count}
      </span>
      <div className="actions">
        <button
          type="button"
          className="btn"
          disabled={disabled || page === 0}
          onClick={() => onPage(page - 1)}
        >
          Sebelumnya
        </button>
        <span>
          Halaman {page + 1} / {pages}
        </span>
        <button
          type="button"
          className="btn"
          disabled={disabled || page + 1 >= pages}
          onClick={() => onPage(page + 1)}
        >
          Berikutnya
        </button>
      </div>
    </div>
  );
}

export default function DataTable<T>({
  rows,
  renderRow,
  resetKey = "",
  paginationDisabled = false,
  children,
  ...props
}: TableProps & {
  rows?: readonly T[];
  renderRow?: (row: T) => ReactNode;
  resetKey?: string;
  paginationDisabled?: boolean;
}) {
  const [position, setPosition] = useState({
    key: resetKey,
    page: 0,
    size: 25,
  });
  const page = Math.min(
    position.key === resetKey ? position.page : 0,
    Math.max(0, Math.ceil((rows?.length ?? 0) / position.size) - 1),
  );
  if (position.key !== resetKey || position.page !== page) {
    setPosition({ ...position, key: resetKey, page });
  }
  return (
    <>
      <TableContainer className="mui-table-container">
        <Table {...props}>
          {children}
          {rows && renderRow ? (
            <MuiTableBody>
              {rows
                .slice(page * position.size, (page + 1) * position.size)
                .map(renderRow)}
            </MuiTableBody>
          ) : null}
        </Table>
      </TableContainer>
      {rows && renderRow ? (
        <PageControls
          count={rows.length}
          page={page}
          size={position.size}
          disabled={paginationDisabled}
          onPage={(next) =>
            setPosition({ ...position, key: resetKey, page: next })
          }
          onSize={(size) => setPosition({ key: resetKey, page: 0, size })}
        />
      ) : null}
    </>
  );
}
