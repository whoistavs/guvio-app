import { colorInfo, colorScore, suggestMatches, wardrobePalette } from "../../utils/colorHarmony";

const w = (id: string, name: string, category: string, colorTag: string) => ({ id, name, category, colorTag, image: "" });
const wardrobe = [
  w("1", "Camiseta", "Camisetas", "Branco"),
  w("2", "Calça", "Calças", "Azul-marinho"),
  w("3", "Jaqueta", "Casacos", "Laranja"),
  w("4", "Tênis", "Calçados", "Verde"),
  w("5", "Blusa", "Camisetas", "Azul"),
  w("6", "Saia", "Saias", "Rosa")
];

describe("cores", () => {
  it("reconhece nomes compostos e sinônimos", () => {
    expect(colorInfo("Azul-marinho")?.label).toBe("Azul-marinho");
    expect(colorInfo("Caramelo")?.label).toBe("Marrom");
    expect(colorInfo("verde oliva")?.label).toBe("Verde");
    expect(colorInfo("xyz")).toBeNull();
  });
  it("dá notas que fazem sentido", () => {
    expect(colorScore("Preto", "Vermelho")).toBeGreaterThan(colorScore("Verde", "Rosa") - 100);
    expect(colorScore("Azul", "Laranja")).toBeGreaterThanOrEqual(85); // complementares
    expect(colorScore("Laranja", "Rosa")).toBeLessThan(60);
  });
  it("sugere peças de outras partes do corpo, sem a própria", () => {
    const m = suggestMatches(wardrobe[4], wardrobe); // blusa azul
    const ids = m.map(x => x.item.id);
    expect(ids).not.toContain("5");
    expect(ids).not.toContain("1"); // outra parte de cima
    expect(ids[0]).toBe("2"); // marinho: neutra + cor
    expect(ids).toContain("3"); // laranja: complementar
  });
  it("monta a paleta e sugere o que falta", () => {
    const p = wardrobePalette(wardrobe);
    expect(p.have.length).toBe(6);
    expect(p.missing.every(m => !p.have.some(h => h.label === m.label))).toBe(true);
    const neutral = wardrobePalette([w("a", "x", "y", "Preto"), w("b", "x", "y", "Branco")]);
    expect(neutral.missing.length).toBeGreaterThan(0);
    expect(neutral.neutralShare).toBe(100);
  });
});
