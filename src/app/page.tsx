import { MapContainer } from '@/components/Map';
import { PopupCard } from '@/components/Card';
import { ListViewModal } from '@/components/ListView';
import { StoreInitializer } from '@/components/StoreInitializer';
import { NotFoundToast } from '@/components/UI';
import { getTags, getPodcasts } from '@/lib/podcasts';
import { getPlaces } from '@/lib/places';
import { getEvents } from '@/lib/events';

export default async function Home() {
  const tags = await getTags();
  const [podcasts, places, events] = await Promise.all([
    getPodcasts(tags),
    getPlaces(tags),
    getEvents(tags),
  ]);

  return (
    <main className="relative w-full h-screen overflow-hidden">
      <StoreInitializer tags={tags} />
      <MapContainer initialPodcasts={podcasts} initialPlaces={places} initialEvents={events} />
      <PopupCard />
      <ListViewModal />
      <NotFoundToast />
    </main>
  );
}
