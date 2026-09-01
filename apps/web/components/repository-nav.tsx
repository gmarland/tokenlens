import Stack from "@mui/material/Stack";
import { BackLink } from "./ui";

export function RepositoryNav({ repositoryId, queryString = "" }: { repositoryId: string; queryString?: string }) {
  const suffix = queryString ? (queryString.startsWith("?") ? queryString : `?${queryString}`) : "";
  return <Stack direction="row" sx={{ gap: 2, flexWrap: "wrap", my: 2 }}>
    <BackLink href={`/repos/${repositoryId}${suffix}`}>Overview</BackLink>
    <BackLink href={`/repos/${repositoryId}/insights${suffix}`}>Insights</BackLink>
    <BackLink href={`/repos/${repositoryId}/prompts${suffix}`}>Prompts</BackLink>
    <BackLink href={`/repos/${repositoryId}/benchmarks`}>Benchmarks</BackLink>
    <BackLink href={`/repos/${repositoryId}/hotspots${suffix}`}>Hotspots</BackLink>
    <BackLink href={`/repos/${repositoryId}/tools${suffix}`}>Tool health</BackLink>
    <BackLink href={`/repos/${repositoryId}/comparisons`}>Model comparisons</BackLink>
  </Stack>;
}
