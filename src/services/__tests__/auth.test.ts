import { hashPassword } from "../auth";

describe("hashPassword", () => {
  it("is deterministic for the same password", async () => {
    expect(await hashPassword("segredo123")).toBe(await hashPassword("segredo123"));
  });

  it("gives different hashes for different passwords", async () => {
    expect(await hashPassword("segredo123")).not.toBe(await hashPassword("segredo124"));
  });

  it("never returns the password itself", async () => {
    const hash = await hashPassword("segredo123");
    expect(hash).not.toContain("segredo123");
    expect(hash.length).toBeGreaterThan(8);
  });
});
