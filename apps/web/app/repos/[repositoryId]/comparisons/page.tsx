import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { ModelComparisonsDataTable } from "../../../../components/data-tables";
import { InsightCards } from "../../../../components/insight-cards";
import { RepositoryNav } from "../../../../components/repository-nav";
import {
  BackLink,
  Eyebrow,
  Intro,
  Page,
  Panel,
  SectionTitle,
} from "../../../../components/ui";
import { repository } from "../../../../lib/data";
import { repositoryInsightBundle } from "../../../../lib/insights";
import Box from "@mui/material/Box";

export const dynamic = "force-dynamic";

export default async function Comparisons({
  params,
}: {
  params: Promise<{ repositoryId: string }>;
}) {
  const { repositoryId } = await params;
  const [repo, bundle] = await Promise.all([
    repository(repositoryId),
    repositoryInsightBundle(repositoryId),
  ]);
  if (!repo) notFound();
  const insights = bundle.insights.filter(
    (insight) => insight.rule === "matched-model-candidate",
  );
  return (
    <Page>
      <BackLink href="/">← All repositories</BackLink>
      <Eyebrow sx={{ mt: 3 }}>Controlled comparison candidates</Eyebrow>
      <Typography variant="h1">Matched models · {repo.repo.name}</Typography>
      <Intro>
        Only exact normalized prompt text is compared. TokenLens does not
        collect assistant responses, so lower usage is a candidate for a
        separate quality evaluation—not a routing recommendation.
      </Intro>
      <RepositoryNav repositoryId={repositoryId} />
      <SectionTitle>Opportunities</SectionTitle>
      <Panel>
        <InsightCards
          insights={insights}
          empty="No exact prompt has at least three complete observations on two models or providers yet."
        />
      </Panel>
      <Box id="observations" sx={{ mt: 8 }}>
        <SectionTitle>Matched observations</SectionTitle>
        <ModelComparisonsDataTable rows={bundle.comparisons} />
      </Box>
    </Page>
  );
}
