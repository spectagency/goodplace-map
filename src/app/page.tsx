import { MapContainer } from '@/components/Map';
import { PopupCard } from '@/components/Card';
import { ListViewModal } from '@/components/ListView';
import { StoreInitializer } from '@/components/StoreInitializer';
import { NotFoundToast } from '@/components/UI';
import { getTags, getPodcasts } from '@/lib/podcasts';

export default async function Home() {
  const tags = await getTags();
  const podcasts = await getPodcasts(tags);

  return (
    <main className="relative w-full h-screen overflow-hidden">
      <StoreInitializer tags={tags} />
      <MapContainer initialPodcasts={podcasts} />
      <PopupCard />
      <ListViewModal />
      <NotFoundToast />
    </main>
  );
}
