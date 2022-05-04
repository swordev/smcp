import { iterate, compareArray } from "../../src/utils/object";

describe("iterate", () => {
  it("replaces value", () => {
    expect(
      iterate({ a: { b: { c: 1 } } }, (item) => {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        if (item.key === "c") item.parent!.value[item.key] = 2;
      })
    ).toMatchObject({
      a: {
        b: {
          c: 2,
        },
      },
    });
  });

  it("replaces parent object", () => {
    const result = iterate({ a: { b: { $object: 1 } } }, (item) => {
      if (
        typeof item.value === "object" &&
        item.value &&
        "$object" in item.value
      ) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        item.parent!.value[item.key] = 1;
        return false;
      }
    });

    expect(result).toMatchObject({
      a: {
        b: 1,
      },
    });
  });
});

describe("compareArray", () => {
  it("returns true", () => {
    expect(compareArray([], [])).toBeTruthy();
    expect(compareArray([0], [0])).toBeTruthy();
    expect(compareArray([1], [1])).toBeTruthy();
    expect(compareArray(["a", 2, "b"], ["a", 2, "b"])).toBeTruthy();
  });
  it("returns false", () => {
    expect(compareArray([0], [])).toBeFalsy();
    expect(compareArray([], [0])).toBeFalsy();
    expect(compareArray(["a", 2, "b"], ["a", "2", "b"])).toBeFalsy();
  });
});
