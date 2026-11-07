import { parseProfileLink, profileLink } from "../../utils/profileLink";
import { parseCaption } from "../../components/RichCaption";

describe("profile links", () => {
  it("round-trips usernames", () => {
    expect(profileLink("@ana.moda")).toBe("guvio://u/ana.moda");
    expect(parseProfileLink(profileLink("ana.moda"))).toBe("ana.moda");
  });
  it("accepts variants and rejects others", () => {
    expect(parseProfileLink("guvio:///u/joao_1")).toBe("joao_1");
    expect(parseProfileLink("https://guvio.app/u/maria?x=1")).toBe("maria");
    expect(parseProfileLink("guvio://auth/callback#access_token=x")).toBeNull();
    expect(parseProfileLink(null)).toBeNull();
  });
});

describe("parseCaption", () => {
  it("finds hashtags and mentions with accents", () => {
    const parts = parseCaption("Look de verão #streetwear com @ana.moda #moçaFashion");
    const links = parts.filter(p => p.type !== "text").map(p => `${p.type}:${p.value}`);
    expect(links).toEqual(["tag:streetwear", "mention:ana.moda", "tag:moçaFashion"]);
  });
  it("ignores e-mails", () => {
    const parts = parseCaption("me chama em ana@gmail.com");
    expect(parts.every(p => p.type === "text")).toBe(true);
  });
});
