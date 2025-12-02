export interface Episode {
    id: string;
    fieldData: {
      name: string;
      'latitude-2': string;
      'longitude-2': string;
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