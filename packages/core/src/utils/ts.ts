export type Await<T> = T extends Promise<infer U> ? U : T;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FunctionType = (...args: any) => any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ConstructorType<T = any> = new (...args: any) => T;

export type ReplaceReturnType<T extends FunctionType, TNewReturn> = (
  ...a: Parameters<T>
) => TNewReturn;

export type ResolveFunctionType<T extends FunctionType> = ReplaceReturnType<
  T,
  Promise<Await<ReturnType<T>>>
>;

export type ResolveConstructorType<T extends ConstructorType> = {
  [K in keyof InstanceType<T>]: ResolveFunctionType<InstanceType<T>[K]>;
};

export type ResolveType<T> = T extends ConstructorType
  ? ResolveConstructorType<T>
  : T extends FunctionType
  ? ResolveFunctionType<T>
  : {
      [K in keyof T]: ResolveType<T[K]>;
    };

export type Writeable<T> = { -readonly [P in keyof T]: T[P] };

export type PartialPicker<T, K extends keyof T> = Partial<Pick<T, K>> &
  Omit<T, K>;
