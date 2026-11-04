"use client";

import Table, { type TableProps } from "@mui/material/Table";
import TableContainer from "@mui/material/TableContainer";

export { default as TableBody } from "@mui/material/TableBody";
export { default as TableCell } from "@mui/material/TableCell";
export { default as TableFooter } from "@mui/material/TableFooter";
export { default as TableHead } from "@mui/material/TableHead";
export { default as TableRow } from "@mui/material/TableRow";

export default function DataTable(props: TableProps) {
  return (
    <TableContainer className="mui-table-container">
      <Table {...props} />
    </TableContainer>
  );
}
