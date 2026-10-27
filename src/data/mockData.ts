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

export interface ClothingTag {
  id: string;
  name: string;
  brand: string;
  price?: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
}

export interface FeedPost {
  id: string;
  userId?: string;
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
  clothingTags?: ClothingTag[];
}

export interface WardrobeItem {
  id: string;
  name: string;
  category: string;
  colorTag: string;
  image: string;
}

export interface StoryItem {
  id: string;
  image: string;
  timestamp: string;
  caption?: string;
}

export interface UserStoryGroup {
  id: string;
  username: string;
  displayName: string;
  avatar: string;
  flag?: string;
  isMe?: boolean;
  hasUnseen?: boolean;
  stories: StoryItem[];
}

export interface ActivityItem {
  id: string;
  type: "like" | "comment" | "follow";
  userId: string;
  username: string;
  userAvatar: string;
  message: string;
  timeAgo: string;
  postImage?: string;
  isFollowing?: boolean;
  timeCategory: "today" | "week" | "earlier";
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
  following?: number;
  postsCount?: number;
  bio?: string;
  website?: string;
  verified?: boolean;
  isFollowing?: boolean;
}

export const MOCK_PROFILES: UserProfile[] = [
  {
    id: "p-elena",
    username: "elena.milan",
    displayName: "Elena Rossi",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=300",
    location: "Milão, Itália",
    followers: 12450,
    following: 412,
    postsCount: 48,
    bio: "Diretora criativa & consultora de moda em Milão. Quiet luxury & alfaiataria atemporal.",
    website: "elenarossi.style",
    verified: true
  },
  {
    id: "p-kai",
    username: "kai.tokyo",
    displayName: "Kai Tanaka",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=300",
    location: "Tóquio, Japão",
    followers: 28900,
    following: 380,
    postsCount: 112,
    bio: "Streetwear minimalista & techwear em Shibuya. Curadoria do novo futurismo oriental.",
    website: "tokyokai.jp",
    verified: true
  },
  {
    id: "p-lucas",
    username: "lucas.paris",
    displayName: "Lucas Delacroix",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=300",
    location: "Paris, França",
    followers: 18320,
    following: 290,
    postsCount: 64,
    bio: "Stylist & fotógrafo de moda em Paris. Trench coats e silhuetas monocromáticas.",
    website: "lucasparis.co",
    verified: true
  },
  {
    id: "p-maya",
    username: "maya.sp",
    displayName: "Maya Drummond",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=300",
    location: "São Paulo, Brasil",
    followers: 9840,
    following: 512,
    postsCount: 37,
    bio: "Moda autoral brasileira & design sustentável. Cores quentes e tecidos naturais.",
    website: "mayadrummond.com.br",
    verified: false
  }
];

export const INITIAL_STORIES: UserStoryGroup[] = [
  {
    id: "me",
    username: "voce",
    displayName: "Seu story",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
    isMe: true,
    hasUnseen: false,
    stories: []
  },
  {
    id: "story-paris",
    username: "lucas.paris",
    displayName: "Paris",
    avatar: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=200",
    flag: "🇫🇷",
    hasUnseen: true,
    stories: [
      {
        id: "st-fr-1",
        image: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=800",
        timestamp: "Há 2h",
        caption: "Manhã de desfile em Le Marais 🥐✨"
      },
      {
        id: "st-fr-2",
        image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?q=80&w=800",
        timestamp: "Há 1h",
        caption: "Linhas limpas e quiet luxury para o outono parisiense."
      }
    ]
  },
  {
    id: "story-tokyo",
    username: "kai.tokyo",
    displayName: "Tóquio",
    avatar: "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=200",
    flag: "🇯🇵",
    hasUnseen: true,
    stories: [
      {
        id: "st-jp-1",
        image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?q=80&w=800",
        timestamp: "Há 3h",
        caption: "Harajuku drop da semana! 🎌"
      }
    ]
  },
  {
    id: "story-milan",
    username: "elena.milan",
    displayName: "Milão",
    avatar: "https://images.unsplash.com/photo-1513584684374-8bab748fbf90?q=80&w=200",
    flag: "🇮🇹",
    hasUnseen: true,
    stories: [
      {
        id: "st-it-1",
        image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=800",
        timestamp: "Há 4h",
        caption: "Corte artesanal milanês na Galleria ☕"
      }
    ]
  },
  {
    id: "story-sp",
    username: "maya.sp",
    displayName: "São Paulo",
    avatar: "https://images.unsplash.com/photo-1543059080-f9b1272213d5?q=80&w=200",
    flag: "🇧🇷",
    hasUnseen: true,
    stories: [
      {
        id: "st-br-1",
        image: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=800",
        timestamp: "Há 5h",
        caption: "Encontro de criadores nos Jardins 🌴"
      }
    ]
  }
];

export const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: "act-1",
    type: "like",
    userId: "p-elena",
    username: "elena.milan",
    userAvatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
    message: "curtiu seu look casual.",
    timeAgo: "Há 15 min",
    postImage: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=200",
    timeCategory: "today"
  },
  {
    id: "act-2",
    type: "follow",
    userId: "p-kai",
    username: "kai.tokyo",
    userAvatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200",
    message: "começou a seguir você.",
    timeAgo: "Há 2h",
    isFollowing: false,
    timeCategory: "today"
  },
  {
    id: "act-3",
    type: "comment",
    userId: "p-lucas",
    username: "lucas.paris",
    userAvatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200",
    message: 'comentou: "O caimento dessa peça ficou impecável!"',
    timeAgo: "Há 5h",
    postImage: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?q=80&w=200",
    timeCategory: "today"
  },
  {
    id: "act-4",
    type: "like",
    userId: "p-maya",
    username: "maya.sp",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200",
    message: "curtiu sua combinação monocromática.",
    timeAgo: "Há 2 dias",
    postImage: "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?q=80&w=200",
    timeCategory: "week"
  },
  {
    id: "act-5",
    type: "follow",
    userId: "p-maya",
    username: "maya.sp",
    userAvatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200",
    message: "começou a seguir você.",
    timeAgo: "Há 3 dias",
    isFollowing: true,
    timeCategory: "week"
  }
];

export interface CommentItem { id: string; postId: string; username: string; avatar: string; text: string; createdAt: string; likes: number; }
export interface DirectThread { id: string; profileId: string; username: string; avatar: string; lastMessage: string; time: string; unread?: number; }

export const MOCK_COMMENTS: CommentItem[] = [];

export const MOCK_DIRECTS: DirectThread[] = [
  {
    id: "dir-1",
    profileId: "p-elena",
    username: "elena.milan",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200",
    lastMessage: "Adorei a composição com tons neutros!",
    time: "10:14",
    unread: 1
  },
  {
    id: "dir-2",
    profileId: "p-kai",
    username: "kai.tokyo",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200",
    lastMessage: "Onde você comprou essa jaqueta oversized?",
    time: "Ontem",
    unread: 0
  },
  {
    id: "dir-3",
    profileId: "p-lucas",
    username: "lucas.paris",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=200",
    lastMessage: "Vamos combinar um ensaio na Fashion Week.",
    time: "Seg",
    unread: 0
  }
];
