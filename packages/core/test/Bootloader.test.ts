import bootloader from "./Bootloader.sample";

describe("Bootloader.start", () => {
  it("returns initial value", async () => {
    const exports = await bootloader.start();
    expect(typeof exports.get).toBe("function");
    expect(typeof exports.increment).toBe("function");
  });
});
