import { NdaCreator } from "@/components/NdaCreator";
import { loadStandardTerms } from "@/lib/standardTerms";

export default async function Home() {
  const { markdown, clauses, footer } = await loadStandardTerms();
  return <NdaCreator standardTermsMarkdown={markdown} clauses={clauses} footer={footer} />;
}
