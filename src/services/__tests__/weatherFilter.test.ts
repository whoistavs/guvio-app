import { matchesWeather } from "../../utils/weatherFilter";

const base: any = { id: "1", caption: "", styleTag: "Novo look", clothingTags: [] };

test("usa o clima salvo no post", () => {
  expect(matchesWeather({ ...base, tempC: 10, weather: "chuva" }, "chuva")).toBe(true);
  expect(matchesWeather({ ...base, tempC: 10, weather: "chuva" }, "frio")).toBe(true);
  expect(matchesWeather({ ...base, tempC: 10, weather: "chuva" }, "calor")).toBe(false);
  expect(matchesWeather({ ...base, tempC: 30, weather: "sol" }, "calor")).toBe(true);
});

test("sem clima salvo, olha a legenda e as peças", () => {
  expect(matchesWeather({ ...base, caption: "Dia de chuva em Braga" }, "chuva")).toBe(true);
  expect(matchesWeather({ ...base, clothingTags: [{ id: "t", name: "Casaco de lã" }] }, "frio")).toBe(true);
  expect(matchesWeather({ ...base, caption: "praia com a galera" }, "calor")).toBe(true);
  expect(matchesWeather({ ...base, caption: "look de trabalho" }, "chuva")).toBe(false);
});

test("palavras com acento", () => {
  expect(matchesWeather({ ...base, caption: "suéter de tricô" }, "frio")).toBe(true);
  expect(matchesWeather({ ...base, caption: "verão chegou" }, "calor")).toBe(true);
  expect(matchesWeather({ ...base, caption: "solteiro" }, "calor")).toBe(false);
});
