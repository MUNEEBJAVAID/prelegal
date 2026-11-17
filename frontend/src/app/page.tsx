import { NdaCreator } from "@/components/NdaCreator";
import { loadStandardTerms } from "@/lib/standardTerms";

export default async function Home() {
  return <NdaCreator terms={await loadStandardTerms()} />;
}
