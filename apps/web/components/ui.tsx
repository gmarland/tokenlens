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
      sx={{ maxWidth: 1440, px: { xs: 2.5, sm: 4, md: 8 }, pt: { xs: 5, md: 9 }, pb: { xs: 10, md: 16 } }}
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
      sx={{ alignItems: { xs: "flex-start", md: "flex-end" }, justifyContent: "space-between" }}
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
        gap: 0,
        my: { xs: 4, md: 6 },
      }}
    >
      {children}
    </Box>
  );
}

export function MetricCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card variant="outlined" sx={{ bgcolor: "primary.main", color: "primary.contrastText", borderColor: "#444", position: "relative" }}>
      <Box sx={{ position: "absolute", top: 0, left: 0, width: 5, height: 18, bgcolor: "secondary.main" }} />
      <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
        <Typography sx={{ color: "#aaa", fontSize: 10, fontWeight: 800, letterSpacing: ".09em", textTransform: "uppercase" }}>{label}</Typography>
        <Typography sx={{ mt: 1, fontSize: 30, fontWeight: 750, lineHeight: 1, letterSpacing: "-.035em" }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}

export function StatCard({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Card variant="outlined">
      <CardContent sx={{ p: 3, "&:last-child": { pb: 3 } }}>
        <Label>{label}</Label>
        <Typography sx={{ mt: 1.5, fontSize: 17, fontWeight: 800, letterSpacing: "-.02em" }}>{value}</Typography>
      </CardContent>
    </Card>
  );
}

export function Panel({ children, sx = {} }: { children: ReactNode; sx?: object }) {
  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3.5 }, mt: 2, boxShadow: "-8px 8px 0 #d5d5cb", ...sx }}>
      {children}
    </Paper>
  );
}

export function ResponsiveTable({ children }: { children: ReactNode }) {
  return (
    <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, boxShadow: "8px 8px 0 #d5d5cb" }}>
      {children}
    </TableContainer>
  );
}

export function Eyebrow({ children, sx = {} }: { children: ReactNode; sx?: object }) {
  return (
    <Typography
      variant="overline"
      sx={{ color: "text.primary", display: "flex", alignItems: "center", gap: 1.25, ...sx,
        "&::before": { content: '""', display: "inline-block", width: 24, height: 4, bgcolor: "secondary.main", flex: "0 0 auto" },
      }}
    >
      {children}
    </Typography>
  );
}

export function Intro({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary" sx={{ maxWidth: 700, mt: 2.5, fontSize: { xs: 16, md: 18 }, lineHeight: 1.5 }}>{children}</Typography>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Typography variant="h2" sx={{ mt: { xs: 7, md: 11 }, mb: 3, pt: 3, borderTop: "1px solid", borderColor: "primary.main" }}>{children}</Typography>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary" sx={{ fontSize: 10, fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>{children}</Typography>;
}

export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <MuiLink component={Link} href={href} underline="hover" sx={{ color: "primary.main", fontWeight: 800 }}>
      {children}
    </MuiLink>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <Typography color="text.secondary" sx={{ textAlign: "center", px: 2, py: 7.5 }}>{children}</Typography>;
}

export const numericCellSx = { textAlign: "right", fontVariantNumeric: "tabular-nums" } as const;
