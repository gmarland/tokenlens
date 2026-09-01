import { permanentRedirect } from "next/navigation";

export default async function Benchmarks({ params }: PageProps<"/repos/[repositoryId]/benchmarks">) {
  const { repositoryId } = await params;
  permanentRedirect(`/repos/${repositoryId}#prompt-benchmarks`);
}
