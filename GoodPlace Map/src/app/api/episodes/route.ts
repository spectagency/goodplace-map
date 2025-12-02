import { NextResponse } from 'next/server';

export async function GET() {
  const collectionId = process.env.WEBFLOW_COLLECTION_ID;
  const token = process.env.WEBFLOW_SITE_API_TOKEN;

  try {
    const response = await fetch(
      `https://api.webflow.com/v2/collections/${collectionId}/items`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'accept-version': '2.0.0',
        },
        next: { revalidate: 60 }, // cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Webflow API error: ${response.status}`);
    }

    const data = (await response.json()) as { items: unknown[] };
    return NextResponse.json(data.items);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 });
  }
}