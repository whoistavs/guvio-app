import { WardrobeItem, OutfitStyle } from "../data/mockData";
import { WeatherData } from "./weather";

export interface AIOutfitRecommendation {
  style: OutfitStyle;
  matchedItems: WardrobeItem[];
  reasoning: string;
  matchScore: number;
}

export function getWeatherRecommendationTip(weather?: WeatherData | null): string {
  if (!weather) {
    return "💡 Dica de Estilo Guvio: Camadas leves com jaqueta coringa são ideais para qualquer clima urbano.";
  }

  const { temperature, condition } = weather;
  if (temperature < 15) {
    return `❄️ Frio em foco (${temperature}°C - ${condition}): A IA recomenda casacos estruturados, gola alta e botas de couro.`;
  }
  if (temperature <= 22) {
    return `🍂 Clima Ameno (${temperature}°C - ${condition}): Camisas de manga longa, suéteres leves e tênis casuais são perfeitos.`;
  }
  return `☀️ Clima Quente (${temperature}°C - ${condition}): Tecidos fluídos como linho, camisetas de algodão e calçados abertos.`;
}

export function generateSmartOutfit(
  style: OutfitStyle, 
  wardrobe: WardrobeItem[], 
  weather?: WeatherData | null
): AIOutfitRecommendation {
  if (wardrobe.length === 0) {
    return {
      style,
      matchedItems: [],
      reasoning: "Você ainda não possui peças cadastradas no seu guarda-roupa.",
      matchScore: 0
    };
  }

  const temp = weather?.temperature ?? 22;
  const isCold = weather?.isCold ?? (temp < 18);
  const isWarm = weather?.isWarm ?? (temp >= 22);
  const condition = weather?.condition || "Tempo Limpo";

  // Categorize items
  const heavyCoats = wardrobe.filter(i => 
    i.category.toLowerCase().includes("sobreatudo") || 
    i.category.toLowerCase().includes("sobretudo") || 
    i.category.toLowerCase().includes("jaqueta") || 
    i.category.toLowerCase().includes("casaco")
  );

  const lightTops = wardrobe.filter(i => 
    i.category.toLowerCase().includes("camiseta") || 
    i.category.toLowerCase().includes("top") ||
    i.category.toLowerCase().includes("camisa")
  );

  const pants = wardrobe.filter(i => 
    i.category.toLowerCase().includes("calça") || 
    i.category.toLowerCase().includes("shorts") || 
    i.category.toLowerCase().includes("saia")
  );

  const shoes = wardrobe.filter(i => 
    i.category.toLowerCase().includes("calçado") || 
    i.category.toLowerCase().includes("tênis") || 
    i.category.toLowerCase().includes("sapato")
  );

  const matchedItems: WardrobeItem[] = [];

  // Weather-based top selection
  if (isCold) {
    if (heavyCoats.length > 0) matchedItems.push(heavyCoats[0]);
    if (lightTops.length > 0) matchedItems.push(lightTops[0]);
  } else {
    if (lightTops.length > 0) matchedItems.push(lightTops[0]);
    else if (heavyCoats.length > 0) matchedItems.push(heavyCoats[0]);
  }

  // Pants selection
  if (pants.length > 0 && !matchedItems.includes(pants[0])) {
    matchedItems.push(pants[0]);
  } else if (wardrobe.length > 1 && !matchedItems.includes(wardrobe[1])) {
    matchedItems.push(wardrobe[1]);
  }

  // Shoes selection
  if (shoes.length > 0 && !matchedItems.includes(shoes[0])) {
    matchedItems.push(shoes[0]);
  } else if (wardrobe.length > 2 && !matchedItems.includes(wardrobe[2])) {
    matchedItems.push(wardrobe[2]);
  }

  // Ensure up to 3 items
  const finalItems = matchedItems.slice(0, 3);
  if (finalItems.length < 3 && wardrobe.length > finalItems.length) {
    for (const item of wardrobe) {
      if (!finalItems.includes(item)) {
        finalItems.push(item);
        if (finalItems.length === 3) break;
      }
    }
  }

  // Weather reasoning
  let reasoning = "";
  if (isCold) {
    reasoning = `Temperatura de ${temp}°C (${condition}). A IA priorizou camadas térmicas e jaquetas/sobretudos (${finalItems[0]?.name || "casaco"}) para manter o aquecimento com estilo ${style.title}.`;
  } else if (isWarm) {
    reasoning = `Clima agradável de ${temp}°C (${condition}). A IA selecionou tecidos leves e caimento fluído (${finalItems[0]?.name || "camiseta"}) ideal para o clima do destino.`;
  } else {
    reasoning = `Clima ameno de ${temp}°C (${condition}). Visual estruturado em camadas leves equilibrando o estilo ${style.title}.`;
  }

  return {
    style,
    matchedItems: finalItems,
    reasoning,
    matchScore: Math.min(99, 88 + finalItems.length * 3)
  };
}

