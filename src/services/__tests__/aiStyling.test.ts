import { generateSmartOutfit, getWeatherRecommendationTip } from "../aiStyling";
import type { OutfitStyle, WardrobeItem } from "../../data/mockData";
import type { WeatherData } from "../weather";

const style: OutfitStyle = {
  id: "casual",
  title: "Casual",
  iconName: "shirt",
  description: "",
  tag: "",
  image: "",
};

const item = (id: string, category: string): WardrobeItem => ({
  id,
  name: `Peça ${id}`,
  category,
  colorTag: "Preto",
  image: "",
});

const wardrobe: WardrobeItem[] = [
  item("t1", "Camiseta"),
  item("c1", "Jaqueta"),
  item("p1", "Calça"),
  item("s1", "Tênis"),
];

const weather = (temperature: number): WeatherData => ({
  temperature,
  condition: "Céu limpo",
  isCold: temperature < 18,
  isWarm: temperature >= 22,
});

describe("getWeatherRecommendationTip", () => {
  it("returns a generic tip when there is no weather data", () => {
    expect(getWeatherRecommendationTip(null)).toContain("Camadas leves");
  });

  it("recommends coats when it is cold", () => {
    expect(getWeatherRecommendationTip(weather(10))).toContain("casacos");
  });

  it("recommends light fabrics when it is hot", () => {
    expect(getWeatherRecommendationTip(weather(30))).toContain("linho");
  });
});

describe("generateSmartOutfit", () => {
  it("returns no items and score 0 for an empty wardrobe", () => {
    const result = generateSmartOutfit(style, [], weather(20));
    expect(result.matchedItems).toHaveLength(0);
    expect(result.matchScore).toBe(0);
  });

  it("puts a coat first on cold days", () => {
    const result = generateSmartOutfit(style, wardrobe, weather(8));
    expect(result.matchedItems[0].id).toBe("c1");
  });

  it("puts a light top first on warm days", () => {
    const result = generateSmartOutfit(style, wardrobe, weather(28));
    expect(result.matchedItems[0].id).toBe("t1");
  });

  it("never suggests more than 3 items or the same item twice", () => {
    const result = generateSmartOutfit(style, wardrobe, weather(15));
    const ids = result.matchedItems.map((i) => i.id);
    expect(ids.length).toBeLessThanOrEqual(3);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
