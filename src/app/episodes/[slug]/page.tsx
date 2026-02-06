import { MapContainer } from '@/components/Map';
import { PopupCard } from '@/components/Card';
import { ListViewModal } from '@/components/ListView';
import { StoreInitializer } from '@/components/StoreInitializer';
import { NotFoundToast } from '@/components/UI';
import { getPodcastBySlug, getRandomPodcast } from '@/lib/podcasts';

interface EpisodePageProps {
  params: Promise<{ slug: string }>;
}

export default async function EpisodePage({ params }: EpisodePageProps) {
  const { slug } = await params;
  const { podcast, allPodcasts, tags } = await getPodcastBySlug(slug);

  // If podcast not found, get a random one and show a message
  const showNotFoundMessage = !podcast;
  const selectedPodcast = podcast || getRandomPodcast(allPodcasts);

  return (
    <main className="relative w-full h-screen overflow-hidden">
      <StoreInitializer
        tags={tags}
        initialSelectedItem={selectedPodcast}
        showNotFoundMessage={showNotFoundMessage}
      />
      <MapContainer initialPodcasts={allPodcasts} />
      <PopupCard />
      <ListViewModal />
      <NotFoundToast />
    </main>
  );
}

// Generate static params for all episodes (optional, for better performance)
export async function generateStaticParams() {
  // For now, return empty array - episodes will be generated on-demand
  // In production, you could fetch all slugs and pre-generate them
  return [];
}
