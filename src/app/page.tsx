import { Gallery } from "@/components/gallery";
import { SetupState } from "@/components/setup-state";
import { getHomeData } from "@/lib/data";

export default async function Home() {
  const { site, page } = await getHomeData();
  if (!site.configured) return <SetupState />;
  return <Gallery site={site} initial={page} />;
}
