import { FeedPost, UserProfile } from "../data/mockData";
import { CHALLENGES } from "../data/challenges";

export interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: "first", icon: "sprout", title: "Primeiro look", description: "Publicou o primeiro look no Guvio." },
  { id: "ten", icon: "ten", title: "10 looks", description: "Já publicou 10 looks." },
  { id: "fifty", icon: "medal", title: "50 looks", description: "Já publicou 50 looks. Que guarda-roupa!" },
  { id: "traveler", icon: "luggage", title: "Viajante", description: "Publicou looks em 3 cidades diferentes." },
  { id: "world", icon: "globe", title: "Cidadão do mundo", description: "Publicou looks em 3 países diferentes." },
  { id: "loved", icon: "heart", title: "Look do momento", description: "Um look passou de 50 curtidas." },
  { id: "popular", icon: "star", title: "Popular", description: "Chegou a 100 seguidores." },
  { id: "challenger", icon: "target", title: "Desafiante", description: "Participou de um desafio da semana." },
  { id: "champion", icon: "trophy", title: "Campeão do desafio", description: "Ficou em 1º lugar num desafio da semana." }
];

const norm = (v: string) => v.trim().toLowerCase();

/** conquistas que dá para saber só com o perfil e os posts (sem consultar o servidor) */
export function computeAchievements(profile: UserProfile, posts: FeedPost[], extra: { champion?: boolean } = {}): Achievement[] {
  const n = Math.max(posts.length, profile.postsCount || 0);
  const cities = new Set(posts.map(p => norm(p.city || "")).filter(Boolean));
  const countries = new Set(posts.map(p => norm(p.country || "")).filter(Boolean));
  const tags = new Set(CHALLENGES.map(c => `#${c.tag}`));
  const joined = posts.some(p => (p.caption || "").toLowerCase().split(/\s+/).some(w => tags.has(w.replace(/[^#a-z0-9]/g, ""))));
  const got = new Set<string>();
  if (n >= 1) got.add("first");
  if (n >= 10) got.add("ten");
  if (n >= 50) got.add("fifty");
  if (cities.size >= 3) got.add("traveler");
  if (countries.size >= 3) got.add("world");
  if (posts.some(p => (p.likes || 0) >= 50)) got.add("loved");
  if ((profile.followers || 0) >= 100) got.add("popular");
  if (joined) got.add("challenger");
  if (extra.champion) got.add("champion");
  return ALL_ACHIEVEMENTS.filter(a => got.has(a.id));
}
