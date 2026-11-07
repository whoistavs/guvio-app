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

import { parsePostLink, postAppLink, postWebLink } from "../../utils/profileLink";
describe("post links", () => {
  it("round-trips ids from app and site links", () => {
    const id = "3f2a9c1e-1111-2222-3333-444455556666";
    expect(parsePostLink(postAppLink(id))).toBe(id);
    expect(parsePostLink(postWebLink(id))).toBe(id);
    expect(parsePostLink("https://whoistavs.github.io/guvio-app/?x=1&p=abcd1234#top")).toBe("abcd1234");
  });
  it("ignores other links", () => {
    expect(parsePostLink("https://whoistavs.github.io/guvio-app/")).toBeNull();
    expect(parsePostLink("guvio://u/ana")).toBeNull();
    expect(parsePostLink("https://x.com/?p=<script>")).toBeNull();
    expect(parseProfileLinkU("https://whoistavs.github.io/guvio-app/?u=ana")).toBe("ana");
  });
});
import { parseProfileLink as parseProfileLinkU } from "../../utils/profileLink";
