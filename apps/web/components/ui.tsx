import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Container from "@mui/material/Container";
import MuiLink from "@mui/material/Link";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import Link from "./link";

export function Page({ children }: { children: ReactNode }) {
  return (
    <Container
      component="main"
      maxWidth={false}
      sx={{ maxWidth: 1240, px: { xs: 2, sm: 3 }, pt: { xs: 3, md: 5.5 }, pb: 10 }}
    >
      {children}
    </Container>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      spacing={1.5}
      sx={{ alignItems: { xs: "flex-start", md: "center" }, justifyContent: "space-between" }}
    >
      {children}
    </Stack>
  );
}

export function Cards({ children, compact = false }: { children: ReactNode; compact?: boolean }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${compact ? 230 : 175}px, 1fr))`,
        gap: 2,
        my: 3.75,
      }}
    >
      {children}
    </Box>
  );
}

export function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Label>{label}</Label>
        <Typography sx={{ mt: 1, fontFamily: "Georgia, serif", fontSize: 29, fontWeight: 500 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Label>{label}</Label>
        <Typography sx={{ mt: 1, fontWeight: 650 }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export function Panel({ children, sx = {} }: { children: ReactNode; sx?: object }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.75, mt: 2, ...sx }}>
      {children}
    </Paper>
  );
}

export function ResponsiveTable({ children }: { children: ReactNode }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 2 }}>
      {children}
    </TableContainer>
  );
}

export function Eyebrow({ children, sx = {} }: { children: ReactNode; sx?: object }) {
  return (
    <Typography
      variant="overline"
      sx={{ color: "primary.main", fontSize: 11, fontWeight: 700, letterSpacing: ".12em", ...sx }}
    >
      {children}
    </Typography>
  );
}

export function Intro({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary" sx={{ maxWidth: 700, mt: 1 }}>{children}</Typography>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Typography variant="h2" sx={{ mt: 4.25, mb: 1.75 }}>{children}</Typography>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary" sx={{ fontSize: 12 }}>{children}</Typography>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <MuiLink component={Link} href={href} underline="hover" sx={{ color: "primary.main", fontWeight: 600 }}>
      {children}
    </MuiLink>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary" sx={{ textAlign: "center", px: 2, py: 7.5 }}>{children}</Typography>;
}

export const numericCellSx = { textAlign: "right", fontVariantNumeric: "tabular-nums" } as const;
