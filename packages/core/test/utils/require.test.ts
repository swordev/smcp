import { deleteCache } from "../../src/utils/require";
import { join } from "path";

describe("deleteCache", () => {
  it("returns one match using exact path", () => {
    require("./require-util-sample");
    const matches = deleteCache([require.resolve("./require-util-sample")]);
    expect(matches).toBe(1);
  });
  it("returns one match using wildcard", () => {
    require("./require-util-sample");
    const matches = deleteCache([join(__dirname, "./require-util-s*")]);
    expect(matches).toBe(1);
  });
});
