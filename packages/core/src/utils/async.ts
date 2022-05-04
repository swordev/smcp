export type PromiseType<TData = void> = Promise<TData> & {
  resolve: (data: TData) => void;
  reject: (error: Error) => void;
};

export function makePromise<TData = void>() {
  let resolve!: (data: TData) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<TData>((_resolve, _reject) => {
    resolve = _resolve;
    reject = _reject;
  }) as PromiseType<TData>;
  promise.resolve = resolve;
  promise.reject = reject;
  return promise;
}
