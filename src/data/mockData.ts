export interface City {
  id: string;
  name: string;
  description: string;
  lat: number;
  lon: number;
  coverImage?: string;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  lat: number;
  lon: number;
  flag: string;
  cities: City[];
}

export interface OutfitStyle {
  id: string;
  title: string;
  iconName: string;
  description: string;
  tag: string;
  image: string;
}

export interface FeedPost {
  id: string;
  creatorName: string;
  creatorAvatar: string;
  city: string;
  country: string;
  styleTag: string;
  image: string;
  caption: string;
  likes: number;
  commentsCount: number;
  timeAgo: string;
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  colorTag: string;
  image: string;
}

// Spherical coordinates helper: converts Lat/Lon (degrees) to 3D Vector (x,y,z) on sphere radius R
export function latLonToVector3(lat: number, lon: number, radius: number = 2.0): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);

  return [x, y, z];
}

export const COUNTRIES: Country[] = [
  {
    id: "jp",
    name: "Japão",
    code: "JPN",
    lat: 36.2048,
    lon: 138.2529,
    flag: "🇯🇵",
    cities: [
      { id: "jp-tokyo", name: "Tóquio", lat: 35.6762, lon: 139.6503, description: "Vanguarda do streetwear contemporâneo e alfaiataria futurista." },
      { id: "jp-osaka", name: "Osaka", lat: 34.6937, lon: 135.5023, description: "Estilo urbano vibrante e descontraído." },
      { id: "jp-kyoto", name: "Kyoto", lat: 35.0116, lon: 135.7681, description: "Elegância tradicional fundida com minimalismo neoclássico." }
    ]
  },
  {
    id: "br",
    name: "Brasil",
    code: "BRA",
    lat: -14.235,
    lon: -51.9253,
    flag: "🇧🇷",
    cities: [
      { id: "br-sp", name: "São Paulo", lat: -23.5505, lon: -46.6333, description: "Moda urbana cosmopolita, alfaiataria desconstruída e tons neutros." },
      { id: "br-campinas", name: "Campinas", lat: -22.9056, lon: -47.0608, description: "Moda urbana do interior paulista com referências contemporâneas." },
      { id: "br-rio", name: "Rio de Janeiro", lat: -22.9068, lon: -43.1729, description: "Leveza tropical minimalista, linho fluido e elegância praiana." },
      { id: "br-salvador", name: "Salvador", lat: -12.9777, lon: -38.5016, description: "Estética artesanal de textura rica e tons monocromáticos calorosos." }
    ]
  },
  {
    id: "us",
    name: "Estados Unidos",
    code: "USA",
    lat: 37.0902,
    lon: -95.7129,
    flag: "🇺🇸",
    cities: [
      { id: "us-ny", name: "Nova York", lat: 40.7128, lon: -74.0060, description: "Minimalismo industrial, oversized darkwear e alfaiataria de luxo." },
      { id: "us-la", name: "Los Angeles", lat: 34.0522, lon: -118.2437, description: "Casual desértico de luxo, tons neutros desbotados e streetwear suave." }
    ]
  },
  {
    id: "fr",
    name: "França",
    code: "FRA",
    lat: 46.2276,
    lon: 2.2137,
    flag: "🇫🇷",
    cities: [
      { id: "fr-paris", name: "Paris", lat: 48.8566, lon: 2.3522, description: "Alta-costura discreta, trench coats impecáveis e estética quiet luxury." },
      { id: "fr-lyon", name: "Lyon", lat: 45.7640, lon: 4.8357, description: "Design estruturado e clássicos reinventados em preto e cinza." }
    ]
  },
  {
    id: "it",
    name: "Itália",
    code: "ITA",
    lat: 41.8719,
    lon: 12.5674,
    flag: "🇮🇹",
    cities: [
      { id: "it-milan", name: "Milão", lat: 45.4642, lon: 9.1900, description: "Corte milanês impecável, couro premium e elegância atemporal." }
    ]
  }
];

export const STYLES: OutfitStyle[] = [
  {
    id: "casual",
    title: "Casual",
    iconName: "shirt",
    description: "Conforto elevado com cortes impecáveis e tecidos premium.",
    tag: "Dia a Dia",
    image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "streetwear",
    title: "Streetwear",
    iconName: "cap",
    description: "Silhuetas oversized, proporções arrojadas e influência urbana.",
    tag: "Urbano",
    image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "social",
    title: "Social",
    iconName: "tshirt",
    description: "Alfaiataria precisa em tons monocromáticos de alto impacto.",
    tag: "Formal",
    image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "esportivo",
    title: "Esportivo",
    iconName: "shoe",
    description: "Design atóxico, athleisure minimalista e tecidos tecnológicos.",
    tag: "Activewear",
    image: "https://images.unsplash.com/photo-1483721310020-03333e577078?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "minimalista",
    title: "Minimalista",
    iconName: "circle",
    description: "Menos é mais: linhas puras, ausência de estampas e equilíbrio perfeito.",
    tag: "Essencial",
    image: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "elegante",
    title: "Elegante",
    iconName: "jacket",
    description: "Quiet luxury com caimento fluído e acabamento artesanal refinado.",
    tag: "Premium",
    image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "date",
    title: "Date",
    iconName: "heart",
    description: "Sofisticação noturna com toque sensorial e caimento marcante.",
    tag: "Noite",
    image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=800&auto=format&fit=crop"
  },
  {
    id: "festa",
    title: "Festa",
    iconName: "party",
    description: "Peças statement monocromáticas desenvolvidas para se destacar.",
    tag: "Eventos",
    image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?q=80&w=800&auto=format&fit=crop"
  }
];

export const MOCK_FEED_POSTS: FeedPost[] = [];

export const MOCK_USER_WARDROBE: WardrobeItem[] = [];

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  location: string;
  followers: number;
  verified?: boolean;
}

export const MOCK_PROFILES: UserProfile[] = [];

export interface CommentItem { id: string; postId: string; username: string; avatar: string; text: string; createdAt: string; likes: number; }
export interface DirectThread { id: string; profileId: string; username: string; avatar: string; lastMessage: string; time: string; unread?: number; }

export const MOCK_COMMENTS: CommentItem[] = [];

export const MOCK_DIRECTS: DirectThread[] = [];

