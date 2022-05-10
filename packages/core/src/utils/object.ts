import mergeWith from "lodash.mergewith";

export enum IterationTypeEnum {
  None,
  Array,
  Object,
}

export function isClass(value: unknown) {
  return typeof value === "function" && /^\s*class\s+/.test(value.toString());
}

export function isInstanceObject(
  value: unknown
): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !isPlainObject(value);
}

export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;

  let proto = value;
  let nextProto: { constructor: () => unknown };

  while ((nextProto = Object.getPrototypeOf(proto))) {
    proto = nextProto;
    if (proto.constructor && proto.constructor !== Object) return false;
  }

  return proto === Object.prototype;
}

export function merge<TObject, TSource>(object: TObject, source: TSource) {
  return mergeWith<TObject, TSource>(object, source, (objValue, srcValue) => {
    if (Array.isArray(objValue)) {
      return srcValue;
    }
  });
}

type IterateStackType = {
  key: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  parent: IterateStackType | undefined;
};

export function iterate(
  data: unknown,
  cb: (
    stack: IterateStackType,
    iterationType: IterationTypeEnum
  ) => boolean | void
) {
  const stacks: IterateStackType[] = [
    {
      key: "",
      value: data,
      parent: undefined,
    },
  ];

  while (stacks.length) {
    const stack = stacks.shift() as IterateStackType;

    const iterationType: IterationTypeEnum = Array.isArray(stack.value)
      ? IterationTypeEnum.Array
      : isPlainObject(stack.value)
      ? IterationTypeEnum.Object
      : IterationTypeEnum.None;

    const cbResult = cb(stack, iterationType);

    if (cbResult === false || iterationType === IterationTypeEnum.None)
      continue;

    const newStack: IterateStackType[] = [];

    for (const key in stack.value)
      newStack.push({
        key: key,
        value: stack.value[key],
        parent: stack,
      });

    stacks.unshift(...newStack);
  }

  return data;
}

export function toArrayBuffer(buffer: Buffer) {
  const ab = new ArrayBuffer(buffer.length);
  const view = new Uint8Array(ab);
  for (let i = 0; i < buffer.length; ++i) {
    view[i] = buffer[i];
  }
  return ab;
}

export function getObjectValue(
  object: Record<string, unknown>,
  keys: string[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let ref: any = object;
  for (const key of keys) {
    if (key in ref) {
      ref = ref[key];
    } else {
      return null;
    }
  }
  return ref;
}

export class StrictMap<K, V> extends Map<K, V> {
  get(key: K) {
    const item = super.get(key);
    if (!item) throw new Error(`Map key not found: ${key}`);
    return item;
  }
}

export function compareArray(a1: unknown[], a2: unknown[]) {
  return !!(
    a1.length === a2.length && a1.every((v1, index) => v1 === a2[index])
  );
}
