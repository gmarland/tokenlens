import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { RepositoryNav } from "../../../../components/repository-nav";
import { RepositoryStructureCards } from "../../../../components/repository-structure-cards";
import { RepositoryStructureTimeline } from "../../../../components/repository-timelines";
import {
  BackLink,
  Eyebrow,
  Intro,
  Page,
  SectionTitle,
  Toolbar,
} from "../../../../components/ui";
import { repository } from "../../../../lib/data";

export const dynamic = "force-dynamic";

export default async function Structure({
  params,
}: PageProps<"/repos/[repositoryId]/structure">) {
  const { repositoryId } = await params;
  const data = await repository(repositoryId);
  if (!data) notFound();
  const snapshot = data.repo.snapshot ?? {};

  return (
    <Page>
      <Toolbar>
        <Box>
          <Eyebrow>Repository architecture</Eyebrow>
          <Typography variant="h1">{data.repo.name}</Typography>
          <Intro>
            Current repository shape and structural change over time.
          </Intro>
        </Box>
      </Toolbar>
      <RepositoryNav repositoryId={repositoryId} />
      <SectionTitle>Current structure</SectionTitle>
      <RepositoryStructureCards snapshot={snapshot} />
      <Box id="structure" sx={{ mt: 8 }}>
        <RepositoryStructureTimeline
          snapshots={data.snapshots}
          commits={data.commits}
        />
      </Box>
    </Page>
  );
}
