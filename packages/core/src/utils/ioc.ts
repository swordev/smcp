import { ConstructorType } from "./ts";

type InjectionToken<T = unknown> = ConstructorType<T> | string | symbol;

export abstract class DependencyContainer {
  abstract createChildContainer(): DependencyContainer;
  abstract register<T>(target: InjectionToken<T>, data: { useValue: T }): this;
  abstract resolve<T>(value: InjectionToken<T>): T;
}
