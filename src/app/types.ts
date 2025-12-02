export interface Episode {
    id: string;
    fieldData: {
      name: string;
      latitude: string;
      longitude: string;
      'episode-description'?: string;
      'location-name'?: string;
      'spotify-link'?: string;
      'youtube-link'?: {
        url: string;
        metadata?: {
          html?: string;
        };
      };
    };
  }