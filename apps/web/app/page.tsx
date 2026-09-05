import type { Metadata } from "next";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Container from "@mui/material/Container";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { redirect } from "next/navigation";
import Link from "../components/link";
import { currentWorkspace } from "../lib/auth";

export const metadata: Metadata = {
  title: "TokenLens — Make coding-agent context visible",
  description:
    "Connect Claude Code and Codex telemetry with repository structure to find context-heavy hotspots, diagnose friction, and validate improvements.",
  openGraph: {
    title: "TokenLens — Make coding-agent context visible",
    description:
      "Evidence-backed context intelligence for teams building with Claude Code and Codex.",
    type: "website",
  },
};

const sectionWidth = {
  width: "100%",
  maxWidth: 1440,
  mx: "auto",
  px: { xs: 2.5, sm: 4, md: 8 },
};

function Arrow() {
  return <Box component="span" aria-hidden="true" sx={{ ml: 0.75 }}>↗</Box>;
}

function ProductPreview() {
  return (
    <Box sx={{ position: "relative", pb: 2, pr: { xs: 1, sm: 2 } }}>
      <Box
        aria-hidden="true"
        sx={{
          position: "absolute",
          inset: { xs: "12px 0 0 12px", sm: "18px 0 0 18px" },
          bgcolor: "secondary.main",
          border: "1px solid",
          borderColor: "primary.main",
        }}
      />
      <Paper
        variant="outlined"
        aria-label="Example TokenLens context analysis"
        sx={{ position: "relative", bgcolor: "primary.main", color: "white", p: { xs: 2.25, sm: 3 } }}
      >
        <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
          <Typography variant="overline" sx={{ color: "#aaa" }}>Repository signal</Typography>
          <Chip
            label="High confidence"
            size="small"
            sx={{ bgcolor: "secondary.main", color: "primary.main" }}
          />
        </Stack>
        <Typography sx={{ mt: 2, fontSize: { xs: 24, sm: 30 }, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-.04em" }}>
          Repeated context expansion around shared/services.ts
        </Typography>
        <Typography sx={{ mt: 1.5, color: "#c7c7c7", lineHeight: 1.55 }}>
          Prompts touching this file process 28% more context than the repository median.
        </Typography>

        <Box sx={{ mt: 3, display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, border: "1px solid #444" }}>
          {[
            ["Observed prompts", "84"],
            ["Attribution coverage", "91%"],
          ].map(([label, value]) => (
            <Box key={label} sx={{ p: 2, borderRight: { sm: "1px solid #444" }, "&:last-child": { borderRight: 0 } }}>
              <Typography variant="overline" sx={{ color: "#888" }}>{label}</Typography>
              <Typography sx={{ mt: 0.5, fontSize: 28, fontWeight: 800 }}>{value}</Typography>
            </Box>
          ))}
        </Box>

        <Box sx={{ mt: 3 }}>
          <Typography variant="overline" sx={{ color: "secondary.main" }}>Validate next</Typography>
          <Typography sx={{ mt: 0.75, lineHeight: 1.5 }}>
            Split the shared module behind a narrower entry point, then compare matched prompts.
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

function Feature({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <Box sx={{ borderTop: "1px solid", borderColor: "primary.main", pt: 2.5 }}>
      <Typography variant="overline">{number}</Typography>
      <Typography variant="h3" sx={{ mt: 3, fontSize: { xs: 25, md: 30 } }}>{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 1.5, maxWidth: 390, lineHeight: 1.65 }}>
        {children}
      </Typography>
    </Box>
  );
}

export default async function MarketingHome() {
  if (await currentWorkspace()) redirect("/dashboard");

  return (
    <Box component="main">
      <Box
        component="section"
        sx={{
          borderBottom: "1px solid",
          borderColor: "primary.main",
          backgroundImage:
            "linear-gradient(#efefe9 1px, transparent 1px), linear-gradient(90deg, #efefe9 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <Container maxWidth={false} sx={{ ...sectionWidth, py: { xs: 7, md: 12 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1.08fr) minmax(420px, .92fr)" }, gap: { xs: 7, lg: 10 }, alignItems: "center" }}>
            <Box>
              <Typography variant="overline" sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <Box component="span" sx={{ width: 28, height: 5, bgcolor: "secondary.main", border: "1px solid" }} />
                Context intelligence for coding agents
              </Typography>
              <Typography
                component="h1"
                sx={{
                  mt: 2.5,
                  maxWidth: 790,
                  fontSize: "clamp(3.4rem, 7vw, 7rem)",
                  fontWeight: 800,
                  lineHeight: 0.84,
                  letterSpacing: "-.075em",
                }}
              >
                See what your coding agents spend their context on.
              </Typography>
              <Typography sx={{ mt: 3.5, maxWidth: 680, fontSize: { xs: 18, md: 21 }, lineHeight: 1.5, color: "text.secondary" }}>
                TokenLens connects Claude Code and Codex telemetry with repository structure, so your team can find context-heavy hotspots, diagnose friction, and validate improvements.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ mt: 4, alignItems: { xs: "stretch", sm: "center" } }}>
                <Button component={Link} href="/login" variant="contained" size="large">
                  Start measuring<Arrow />
                </Button>
                <Button component="a" href="#product" variant="outlined" size="large">
                  See how it works
                </Button>
              </Stack>
              <Typography variant="overline" sx={{ display: "block", mt: 3, color: "text.secondary" }}>
                Claude Code + Codex · Local repository analysis
              </Typography>
            </Box>
            <ProductPreview />
          </Box>
        </Container>
      </Box>

      <Box sx={{ bgcolor: "secondary.main", borderBottom: "1px solid", borderColor: "primary.main" }}>
        <Box sx={{ ...sectionWidth, py: 2.25, display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 2 }}>
          {["Repository hotspots", "Tool health", "Prompt benchmarks", "Evidence thresholds"].map((item) => (
            <Typography key={item} variant="overline" sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Box component="span" aria-hidden="true">■</Box>{item}
            </Typography>
          ))}
        </Box>
      </Box>

      <Box component="section" id="product" sx={{ ...sectionWidth, py: { xs: 8, md: 14 }, scrollMarginTop: 90 }}>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: ".75fr 1.25fr" }, gap: { xs: 3, md: 10 } }}>
          <Typography variant="overline">Why TokenLens</Typography>
          <Box>
            <Typography variant="h2" sx={{ maxWidth: 880, fontSize: "clamp(2.4rem, 5vw, 5rem)", lineHeight: 0.93 }}>
              Your agents are working. Now you can see what shapes the work.
            </Typography>
            <Typography sx={{ mt: 3, maxWidth: 720, fontSize: 19, lineHeight: 1.6, color: "text.secondary" }}>
              Token totals tell you what happened. TokenLens connects those totals to repository structure, file traversal, model choice, and tool behaviour—giving teams a defensible place to investigate next.
            </Typography>
          </Box>
        </Box>

        <Box sx={{ mt: { xs: 7, md: 11 }, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: { xs: 5, md: 4 } }}>
          <Feature number="01 / Observe" title="See where context goes.">
            Explore prompt-level context, repository trends, working sets, providers, and models in one consistent view.
          </Feature>
          <Feature number="02 / Explain" title="Find recurring friction.">
            Surface file hotspots, failing tools, structural relationships, and context composition with the evidence attached.
          </Feature>
          <Feature number="03 / Improve" title="Validate what changed.">
            Turn repeatable prompts into benchmarks and track context, duration, tool activity, and traversal over time.
          </Feature>
        </Box>
      </Box>

      <Box component="section" id="how" sx={{ bgcolor: "#f1f1eb", borderBlock: "1px solid", borderColor: "primary.main", scrollMarginTop: 90 }}>
        <Box sx={{ ...sectionWidth, py: { xs: 8, md: 12 } }}>
          <Typography variant="overline">How it works</Typography>
          <Typography variant="h2" sx={{ mt: 2, maxWidth: 720, fontSize: "clamp(2.2rem, 4vw, 4rem)" }}>
            From local signals to useful evidence.
          </Typography>
          <Box sx={{ mt: 6, display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, border: "1px solid", borderColor: "primary.main" }}>
            {[
              ["1", "Install", "Connect Claude Code, Codex, or both with the TokenLens profiler."],
              ["2", "Observe", "Combine agent telemetry with structural analysis performed on your machine."],
              ["3", "Act", "Investigate recommendations with sample size, caveats, and a validation step."],
            ].map(([number, title, copy], index) => (
              <Box key={title} sx={{ p: { xs: 3, md: 4 }, minHeight: 260, borderRight: { md: index < 2 ? "1px solid" : 0 }, borderBottom: { xs: index < 2 ? "1px solid" : 0, md: 0 }, borderColor: "primary.main !important", display: "flex", flexDirection: "column" }}>
                <Typography sx={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: "info.main" }}>{number}</Typography>
                <Typography variant="h3" sx={{ mt: "auto", pt: 5 }}>{title}</Typography>
                <Typography color="text.secondary" sx={{ mt: 1.25, lineHeight: 1.6 }}>{copy}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <Box component="section" id="privacy" sx={{ bgcolor: "primary.main", color: "primary.contrastText", scrollMarginTop: 90 }}>
        <Box sx={{ ...sectionWidth, py: { xs: 8, md: 14 } }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.2fr .8fr" }, gap: { xs: 6, md: 12 } }}>
            <Box>
              <Typography variant="overline" sx={{ color: "secondary.main" }}>Privacy by design</Typography>
              <Typography variant="h2" sx={{ mt: 2, maxWidth: 760, fontSize: "clamp(2.6rem, 5.4vw, 5.5rem)", lineHeight: 0.9 }}>
                Understand the system without reading the work.
              </Typography>
              <Typography sx={{ mt: 3, maxWidth: 700, color: "#bbb", fontSize: 18, lineHeight: 1.65 }}>
                Source and dependency analysis happens locally. TokenLens never receives source contents, assistant responses, tool output, or absolute local paths.
              </Typography>
            </Box>
            <Box>
              <Typography variant="overline" sx={{ color: "#888" }}>Never collected</Typography>
              <Stack sx={{ mt: 2, borderTop: "1px solid #444" }}>
                {["Source file contents", "Assistant responses", "Tool output", "Absolute local paths"].map((item) => (
                  <Typography key={item} sx={{ py: 2, borderBottom: "1px solid #444", fontSize: 17, fontWeight: 700 }}>
                    <Box component="span" aria-hidden="true" sx={{ color: "secondary.main", mr: 1.5 }}>—</Box>{item}
                  </Typography>
                ))}
              </Stack>
              <Typography sx={{ mt: 3, color: "#aaa", fontSize: 13, lineHeight: 1.6 }}>
                TokenLens does collect prompt text, relative file paths, model and tool metadata, and token totals. Deploy it only where that collection matches your privacy policy.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box component="section" sx={{ ...sectionWidth, py: { xs: 8, md: 14 } }}>
        <Paper variant="outlined" sx={{ bgcolor: "secondary.main", p: { xs: 3, sm: 5, md: 7 }, boxShadow: { xs: "-8px 8px 0 #d5d5cb", md: "-14px 14px 0 #d5d5cb" } }}>
          <Typography variant="overline">Built for better systems, not surveillance</Typography>
          <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr auto" }, alignItems: "end", gap: 4 }}>
            <Box>
              <Typography variant="h2" sx={{ maxWidth: 850, fontSize: "clamp(2.4rem, 5vw, 5rem)" }}>
                Make repository context visible.
              </Typography>
              <Typography sx={{ mt: 2, maxWidth: 680, fontSize: 18, lineHeight: 1.6 }}>
                Measure repositories and agent workflows—not employee productivity. Connect your first coding-agent installation and start building an evidence base.
              </Typography>
            </Box>
            <Button component={Link} href="/login" variant="contained" size="large" sx={{ bgcolor: "primary.main", color: "primary.contrastText", whiteSpace: "nowrap" }}>
              Start measuring<Arrow />
            </Button>
          </Box>
        </Paper>
      </Box>

      <Box component="footer" sx={{ borderTop: "1px solid", borderColor: "primary.main" }}>
        <Box sx={{ ...sectionWidth, py: 4, display: "flex", flexDirection: { xs: "column", sm: "row" }, justifyContent: "space-between", gap: 2 }}>
          <Typography sx={{ fontWeight: 800 }}>■ &nbsp;TokenLens</Typography>
          <Typography variant="overline" color="text.secondary">Repository context, made visible.</Typography>
        </Box>
      </Box>
    </Box>
  );
}
