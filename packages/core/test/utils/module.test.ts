import { include } from "../../src/utils/module";

export const value = 0;
describe("include", () => {
  it("returns module exports", async () => {
    const exports: { value: number } = include(__filename);
    expect(exports.value).toBe(0);
  });
});
