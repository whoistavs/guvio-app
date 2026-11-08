// Desafio da semana: um tema por semana, igual para todo mundo, trocando toda segunda-feira.
// Para participar basta publicar um look com a #hashtag do desafio.

export interface Challenge {
  tag: string;
  title: string;
  icon: string;
  description: string;
}

export const CHALLENGES: Challenge[] = [
  { tag: "monocromatico", title: "Look monocromático", icon: "contrast", description: "Uma cor só, da cabeça aos pés. Brinque com texturas e tons da mesma cor." },
  { tag: "pecacoringa", title: "Peça coringa", icon: "shirt", description: "Mostre a peça que você mais usa e como ela combina com tudo." },
  { tag: "brecho", title: "Achado de brechó", icon: "recycle", description: "Monte um look com pelo menos uma peça de brechó ou de segunda mão." },
  { tag: "camadas", title: "Camadas", icon: "layers", description: "Sobreposições criativas: camisa sobre camiseta, colete, jaqueta, cachecol..." },
  { tag: "corforte", title: "Cor forte", icon: "palette", description: "Saia do básico: uma peça de cor vibrante como protagonista do look." },
  { tag: "lookdetrabalho", title: "Look de trabalho", icon: "briefcase", description: "O que você veste para trabalhar ou estudar, com personalidade." },
  { tag: "estampas", title: "Mistura de estampas", icon: "pattern", description: "Listras com xadrez, floral com poá... combine estampas sem medo." },
  { tag: "estilodacidade", title: "Estilo da sua cidade", icon: "city", description: "Um look que tenha a cara da cidade onde você mora (e marque a cidade!)." },
  { tag: "anos90", title: "Anos 90", icon: "retro", description: "Jeans largo, moletom, tênis chunky: reinvente um clássico dos anos 90." },
  { tag: "minimalista", title: "Minimalista", icon: "contrast", description: "Poucas peças, cortes limpos e cores neutras. Menos é mais." },
  { tag: "acessorios", title: "Foco nos acessórios", icon: "gem", description: "Bonés, bolsas, joias, óculos: deixe os acessórios roubarem a cena." },
  { tag: "fimdesemana", title: "Fim de semana", icon: "sun", description: "Seu look preferido para sábado e domingo, confortável e com estilo." }
];

const DAY = 24 * 60 * 60 * 1000;

/** segunda-feira 00:00 (hora local) da semana da data */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // segunda = 0
  x.setDate(x.getDate() - dow);
  return x;
}

// segunda-feira de referência para numerar as semanas
const EPOCH = new Date(2026, 0, 5);

export function weekIndex(d: Date): number {
  return Math.round((weekStart(d).getTime() - weekStart(EPOCH).getTime()) / (7 * DAY));
}

export function currentChallenge(now = new Date()) {
  const idx = weekIndex(now);
  const ch = CHALLENGES[((idx % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
  const start = weekStart(now);
  const end = new Date(start.getTime() + 7 * DAY);
  const daysLeft = Math.max(1, Math.ceil((end.getTime() - now.getTime()) / DAY));
  const next = CHALLENGES[(((idx + 1) % CHALLENGES.length) + CHALLENGES.length) % CHALLENGES.length];
  return { ...ch, start, end, daysLeft, next };
}
