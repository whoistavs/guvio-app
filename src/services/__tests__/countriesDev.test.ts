import { searchCountriesDev } from "../countriesDev";

const json = (data: unknown, status = 200) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(data) } as Response);

describe("searchCountriesDev", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("does not call the API for queries shorter than 2 characters", async () => {
    expect(await searchCountriesDev(" a ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("merges countries and cities, naming each city's country", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/cities")) {
        return json([{ geonameId: 1, name: "Lisboa", countryCode: "pt", latitude: 38.7, longitude: -9.1 }]);
      }
      if (url.includes("/places")) return json([]);
      return json([{ name: "Portugal", alpha2Code: "PT", latlng: [39.5, -8] }]);
    });

    const results = await searchCountriesDev("port");

    expect(results[0]).toMatchObject({ type: "country", label: "Portugal", lat: 39.5, lon: -8 });
    expect(results[1]).toMatchObject({ type: "city", label: "Lisboa", countryCode: "PT", subtitle: "Portugal" });
  });

  it("removes duplicate cities returned by both endpoints", async () => {
    const lisboa = { geonameId: 1, name: "Lisboa", countryCode: "PT", latitude: 38.7, longitude: -9.1 };
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/cities") || url.includes("/places")) return json([lisboa]);
      return json([]);
    });

    const results = await searchCountriesDev("lisboa");
    expect(results.filter((r) => r.label === "Lisboa")).toHaveLength(1);
  });

  it("still returns results when one endpoint fails", async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/cities")) return Promise.reject(new Error("offline"));
      if (url.includes("/places")) return json([], 404);
      return json([{ name: "Brasil", alpha2Code: "BR", latlng: [-10, -55] }]);
    });

    const results = await searchCountriesDev("bra");
    expect(results).toHaveLength(1);
    expect(results[0].label).toBe("Brasil");
  });
});
