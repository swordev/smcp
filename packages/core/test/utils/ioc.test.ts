import { DependencyContainer } from "../../src/utils/ioc";
import "reflect-metadata";
import { container, injectable } from "tsyringe";

function createContainer() {
  const c = container.createChildContainer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.register(DependencyContainer as any, {
    useValue: c,
  });
}

describe("DependencyContainer", () => {
  it("shoulds resolve self container", () => {
    const c = createContainer();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(c.resolve(DependencyContainer as any)).toBe(c);
  });
  it("shoulds resolve self container via the class", () => {
    @injectable()
    class Test {
      constructor(readonly dc: DependencyContainer) {}
    }
    const c = createContainer();
    expect(c.resolve(Test).dc).toBe(c);
  });
});
