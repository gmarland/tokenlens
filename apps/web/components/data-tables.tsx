"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import {
  DataGrid,
  type GridColDef,
  type GridInitialState,
  type GridRowsProp,
} from "@mui/x-data-grid";
import Link from "./link";
import { compact, date, duration, money } from "../lib/format";
import { promptTitle } from "../lib/prompt-presentation";
import type { FileHotspot, MatchedModelComparison, ToolHealth } from "@tokenlens/shared";

const gridSx = {
  border: 0,
  "& .MuiDataGrid-toolbar": {
    borderBottom: "1px solid",
    borderColor: "divider",
    p: 1,
  },
  "& .MuiDataGrid-columnHeaders": {
    bgcolor: "primary.main",
    color: "primary.contrastText",
  },
  "& .MuiDataGrid-columnHeader": {
    bgcolor: "primary.main",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: ".09em",
    textTransform: "uppercase",
  },
  "& .MuiDataGrid-columnHeader .MuiIconButton-root": {
    bgcolor: "transparent",
    color: "inherit",
    "&:hover": { bgcolor: "rgba(255,255,255,.12)" },
  },
  "& .MuiDataGrid-cell": { borderColor: "divider" },
  "& .MuiDataGrid-row:hover": { bgcolor: "rgba(255,255,0,.1)" },
  "& .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within, & .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within": {
    outline: "none",
  },
  "& .MuiDataGrid-columnHeader:focus-visible, & .MuiDataGrid-cell:focus-visible": {
    outline: "2px solid",
    outlineColor: "info.main",
    outlineOffset: "-2px",
  },
  "& .MuiDataGrid-cell--textRight": { fontVariantNumeric: "tabular-nums" },
} as const;

function TableGrid({
  label,
  rows,
  columns,
  initialState,
  initialQuickFilter,
  showToolbar = true,
}: {
  label: string;
  rows: GridRowsProp;
  columns: GridColDef[];
  initialState?: GridInitialState;
  initialQuickFilter?: string;
  showToolbar?: boolean;
}) {
  return (
    <Paper
      variant="outlined"
      sx={{ mt: 2, width: "100%", boxShadow: "8px 8px 0 #d5d5cb", overflow: "hidden" }}
    >
      <DataGrid
        aria-label={label}
        autoHeight
        columns={columns}
        initialState={{
          pagination: { paginationModel: { page: 0, pageSize: 25 } },
          ...(initialQuickFilter ? { filter: { filterModel: { items: [], quickFilterValues: [initialQuickFilter] } } } : {}),
          ...initialState,
        }}
        pageSizeOptions={[10, 25, 50, 100]}
        pagination
        rowSelection={false}
        rows={rows}
        showToolbar={showToolbar}
        slotProps={{
          toolbar: {
            csvOptions: { fileName: label.toLowerCase().replaceAll(" ", "-") },
            printOptions: { disableToolbarButton: true },
            quickFilterProps: { debounceMs: 250 },
          },
        }}
        sx={{ ...gridSx, width: "100%" }}
      />
    </Paper>
  );
}

export type RepositoryTableRow = {
  id: string;
  name: string;
  sourceFiles: number;
  loc: number;
  prompts: number;
  medianContext: number;
  medianFiles: number;
};

export function RepositoriesDataTable({
  rows,
  queryString,
}: {
  rows: RepositoryTableRow[];
  queryString: string;
}) {
  const columns: GridColDef<RepositoryTableRow>[] = [
    {
      field: "name",
      headerName: "Repository",
      minWidth: 220,
      flex: 1,
      renderCell: ({ row }) => (
        <MuiLink
          component={Link}
          href={`/repos/${row.id}${queryString}`}
          color="inherit"
          underline="hover"
          sx={{ fontWeight: 650 }}
        >
          {row.name}
        </MuiLink>
      ),
    },
    { field: "sourceFiles", headerName: "Source files", type: "number", minWidth: 130, valueFormatter: compact },
    { field: "loc", headerName: "LOC", type: "number", minWidth: 105, valueFormatter: compact },
    { field: "prompts", headerName: "Prompts", type: "number", minWidth: 105 },
    { field: "medianContext", headerName: "Median context", type: "number", minWidth: 155, valueFormatter: compact },
    { field: "medianFiles", headerName: "Files read", type: "number", minWidth: 120, valueFormatter: (value) => Number(value).toFixed(1) },
  ];

  return <TableGrid label="Repositories" rows={rows} columns={columns} showToolbar={false} />;
}

export type FileReadTableRow = {
  id: string;
  file: string;
  loc: number;
  reads: number;
  fanOut: number | null;
  module: string;
};

export function FileReadsDataTable({ rows }: { rows: FileReadTableRow[] }) {
  const columns: GridColDef<FileReadTableRow>[] = [
    { field: "file", headerName: "File", minWidth: 320, flex: 1, cellClassName: "file-name" },
    { field: "loc", headerName: "LOC", type: "number", minWidth: 100, valueFormatter: compact },
    { field: "reads", headerName: "Reads", type: "number", minWidth: 100 },
    { field: "fanOut", headerName: "Fan-out", type: "number", minWidth: 110, valueFormatter: (value) => value ?? "—" },
    { field: "module", headerName: "Module", minWidth: 180, flex: 0.5 },
  ];

  return (
    <Box sx={{ "& .file-name": { fontWeight: 650 } }}>
      <TableGrid
        label="Prompt file reads"
        rows={rows}
        columns={columns}
        initialState={{ sorting: { sortModel: [{ field: "reads", sort: "desc" }] } }}
      />
    </Box>
  );
}

export type PromptTableRow = {
  id: string;
  startedAt: string;
  provider: string;
  developer: string;
  prompt: string;
  model: string;
  context: number;
  cost: number | null;
  files: number;
  repeatedReads: number;
  modules: number;
  apiCalls: number;
  firstEdit: number | null;
};

const promptSortFields: Record<string, string> = {
  date: "startedAt",
  context: "context",
  cost: "cost",
  files: "files",
  repeated: "repeatedReads",
  edit: "firstEdit",
};

export function PromptsDataTable({
  rows,
  initialSort = "date",
}: {
  rows: PromptTableRow[];
  initialSort?: string;
}) {
  const columns: GridColDef<PromptTableRow>[] = [
    {
      field: "startedAt",
      headerName: "Time",
      type: "dateTime",
      minWidth: 175,
      valueGetter: (value) => value ? new Date(value) : null,
      valueFormatter: date,
    },
    { field: "provider", headerName: "Provider", minWidth: 120, renderCell: ({ value }) => <Chip size="small" label={value} /> },
    { field: "developer", headerName: "Developer", minWidth: 190 },
    {
      field: "prompt",
      headerName: "Prompt",
      minWidth: 280,
      flex: 1,
      renderCell: ({ row }) => (
        <MuiLink component={Link} href={`/prompts/${row.id}`} color="inherit" sx={{ fontWeight: 650 }}>
          {row.prompt}
        </MuiLink>
      ),
    },
    { field: "model", headerName: "Model", minWidth: 155, renderCell: ({ value }) => <Chip size="small" label={value} /> },
    { field: "context", headerName: "Context", type: "number", minWidth: 120, valueFormatter: compact },
    { field: "cost", headerName: "Cost", type: "number", minWidth: 100, valueFormatter: money },
    { field: "files", headerName: "Files", type: "number", minWidth: 90 },
    { field: "repeatedReads", headerName: "Repeated reads", type: "number", minWidth: 150 },
    { field: "modules", headerName: "Modules", type: "number", minWidth: 105 },
    { field: "apiCalls", headerName: "API calls", type: "number", minWidth: 110 },
    { field: "firstEdit", headerName: "First edit", type: "number", minWidth: 120, valueFormatter: duration },
  ];

  return (
    <TableGrid
      label="Observed prompts"
      rows={rows}
      columns={columns}
      initialState={{
        sorting: { sortModel: [{ field: promptSortFields[initialSort] ?? "startedAt", sort: "desc" }] },
      }}
      showToolbar={false}
    />
  );
}

export function HotspotsDataTable({ rows, initialFile }: { rows: FileHotspot[]; initialFile?: string }) {
  const columns: GridColDef<FileHotspot>[] = [
    { field: "path", headerName: "File", minWidth: 320, flex: 1 },
    { field: "moduleName", headerName: "Module", minWidth: 170 },
    { field: "prompts", headerName: "Prompts", type: "number", minWidth: 100 },
    { field: "promptShare", headerName: "Coverage", type: "number", minWidth: 110, valueFormatter: (value) => `${(Number(value) * 100).toFixed(1)}%` },
    { field: "repeatedReads", headerName: "Repeat reads", type: "number", minWidth: 125 },
    { field: "medianContext", headerName: "Median context", type: "number", minWidth: 150, valueFormatter: compact },
    { field: "contextLiftPercent", headerName: "Context lift", type: "number", minWidth: 125, valueFormatter: (value) => value == null ? "—" : `${Number(value) >= 0 ? "+" : ""}${Number(value).toFixed(1)}%` },
    { field: "loc", headerName: "LOC", type: "number", minWidth: 90, valueFormatter: compact },
    { field: "fanIn", headerName: "Fan-in", type: "number", minWidth: 90 },
    { field: "fanOut", headerName: "Fan-out", type: "number", minWidth: 95 },
    { field: "inCycle", headerName: "Cycle", type: "boolean", minWidth: 90 },
  ];
  return <TableGrid
    label="Repository file hotspots"
    rows={rows.map((row) => ({ ...row, id: row.path }))}
    columns={columns}
    initialQuickFilter={initialFile}
    initialState={{ sorting: { sortModel: [{ field: "contextLiftPercent", sort: "desc" }] } }}
  />;
}

export function ToolHealthDataTable({ rows, initialTool }: { rows: ToolHealth[]; initialTool?: string }) {
  const columns: GridColDef<ToolHealth>[] = [
    { field: "toolName", headerName: "Tool", minWidth: 220, flex: 1 },
    { field: "category", headerName: "Category", minWidth: 110 },
    { field: "calls", headerName: "Calls", type: "number", minWidth: 90 },
    { field: "knownOutcomes", headerName: "Known outcomes", type: "number", minWidth: 145 },
    { field: "failureRate", headerName: "Failure rate", type: "number", minWidth: 125, valueFormatter: (value) => value == null ? "—" : `${(Number(value) * 100).toFixed(1)}%` },
    { field: "medianDurationMs", headerName: "Median duration", type: "number", minWidth: 150, valueFormatter: duration },
    { field: "p95DurationMs", headerName: "p95 duration", type: "number", minWidth: 130, valueFormatter: duration },
    { field: "medianResultBytes", headerName: "Median result", type: "number", minWidth: 135, valueFormatter: compact },
    { field: "p95ResultBytes", headerName: "p95 result", type: "number", minWidth: 120, valueFormatter: compact },
  ];
  return <TableGrid
    label="Repository tool health"
    rows={rows.map((row) => ({ ...row, id: row.toolName }))}
    columns={columns}
    initialQuickFilter={initialTool}
    initialState={{ sorting: { sortModel: [{ field: "calls", sort: "desc" }] } }}
  />;
}

export function ModelComparisonsDataTable({ rows }: { rows: MatchedModelComparison[] }) {
  const columns: GridColDef<MatchedModelComparison>[] = [
    { field: "promptText", headerName: "Matched prompt", minWidth: 300, flex: 1, valueFormatter: (value) => promptTitle(String(value), 100) },
    { field: "provider", headerName: "Provider", minWidth: 110 },
    { field: "model", headerName: "Model", minWidth: 180 },
    { field: "runs", headerName: "Runs", type: "number", minWidth: 85 },
    { field: "medianContext", headerName: "Median context", type: "number", minWidth: 150, valueFormatter: compact },
    { field: "medianDurationMs", headerName: "Median duration", type: "number", minWidth: 150, valueFormatter: duration },
    { field: "medianCostUsd", headerName: "Median cost", type: "number", minWidth: 120, valueFormatter: money },
    { field: "medianFilesRead", headerName: "Median files", type: "number", minWidth: 120, valueFormatter: (value) => value == null ? "—" : Number(value).toFixed(1) },
    { field: "failureRate", headerName: "Tool failures", type: "number", minWidth: 125, valueFormatter: (value) => value == null ? "—" : `${(Number(value) * 100).toFixed(1)}%` },
  ];
  return <TableGrid
    label="Matched model and provider comparisons"
    rows={rows.map((row) => ({ ...row, id: `${row.promptFingerprint}:${row.provider}:${row.model}` }))}
    columns={columns}
    initialState={{ sorting: { sortModel: [{ field: "promptText", sort: "asc" }] } }}
  />;
}
