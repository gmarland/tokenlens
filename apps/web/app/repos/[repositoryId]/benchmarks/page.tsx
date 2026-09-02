import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { PromptBenchmarks } from "../../../../components/prompt-benchmarks";
import { RepositoryNav } from "../../../../components/repository-nav";
import {
  BackLink,
  Eyebrow,
  Intro,
  Page,
  Toolbar,
} from "../../../../components/ui";
import { repository } from "../../../../lib/data";
import { repositoryBenchmarkSummaries } from "../../../../lib/insights";

export const dynamic = "force-dynamic";

export default async function Benchmarks({
  params,
}: PageProps<"/repos/[repositoryId]/benchmarks">) {
  const { repositoryId } = await params;
  const [repo, benchmarks] = await Promise.all([
    repository(repositoryId),
    repositoryBenchmarkSummaries(repositoryId),
  ]);
  if (!repo) notFound();

  return (
    <Page>
      <Toolbar>
        <Box>
          <Eyebrow>Repeatable observations</Eyebrow>
          <Typography variant="h1">{repo.repo.name}</Typography>
          <Intro>
            Exact prompt and model matches tracked across repository revisions.
          </Intro>
        </Box>
      </Toolbar>
      <RepositoryNav repositoryId={repositoryId} />
      <PromptBenchmarks benchmarks={benchmarks} />
    </Page>
  );
}
