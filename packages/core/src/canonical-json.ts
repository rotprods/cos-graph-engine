export const CANONICAL_JSON_WIRE_VERSION = 1 as const;

export type CanonicalJsonPrimitive = null | boolean | number | string;
export type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export interface CanonicalJsonEnvelope<T extends CanonicalJsonValue = CanonicalJsonValue> {
  serializationVersion: typeof CANONICAL_JSON_WIRE_VERSION;
  value: T;
}

/**
 * Convert JavaScript values at persistence/signing boundaries into one explicit
 * canonical JSON wire domain.
 *
 * Rules:
 * - strings and object keys are NFC-normalized;
 * - -0 becomes 0 and non-finite numbers fail closed;
 * - undefined object properties are omitted (the only optional-field coercion);
 * - undefined array entries, sparse arrays, symbols, bigint, functions,
 *   accessors, cycles and non-plain objects are rejected;
 * - normalized-key collisions are rejected;
 * - output is detached plain data and can be passed to canonicalSerialize.
 *
 * `canonicalSerialize` itself intentionally remains strict and never performs
 * this coercion. Producers may use TypeScript optional properties; persistence
 * boundaries must call this function before hashing/storing them.
 */
export function canonicalizeJsonValue(value: unknown): CanonicalJsonValue {
  return visit(value, '$', new Set<object>(), false) as CanonicalJsonValue;
}

export function canonicalJsonEnvelope(value: unknown): CanonicalJsonEnvelope {
  return {
    serializationVersion: CANONICAL_JSON_WIRE_VERSION,
    value: canonicalizeJsonValue(value),
  };
}

function visit(
  value: unknown,
  path: string,
  seen: Set<object>,
  allowUndefinedObjectProperty: boolean,
): CanonicalJsonValue | undefined {
  if (value === undefined) {
    if (allowUndefinedObjectProperty) return undefined;
    throw new Error(`${path} contains undefined outside an optional object property`);
  }
  if (value === null) return null;

  switch (typeof value) {
    case 'string':
      return value.normalize('NFC');
    case 'boolean':
      return value;
    case 'number':
      if (!Number.isFinite(value)) throw new Error(`${path} contains a non-finite number`);
      return Object.is(value, -0) ? 0 : value;
    case 'bigint':
    case 'function':
    case 'symbol':
      throw new Error(`${path} contains unsupported ${typeof value}`);
    case 'object':
      break;
    default:
      throw new Error(`${path} contains unsupported ${typeof value}`);
  }

  const object = value as object;
  if (seen.has(object)) throw new Error(`${path} contains a cycle`);
  seen.add(object);
  try {
    if (Array.isArray(value)) {
      const descriptors = Object.getOwnPropertyDescriptors(value);
      const output: CanonicalJsonValue[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = descriptors[String(index)];
        if (!descriptor) throw new Error(`${path} contains a sparse array hole at index ${index}`);
        if (!('value' in descriptor)) throw new Error(`${path}[${index}] uses an accessor`);
        output.push(visit(descriptor.value, `${path}[${index}]`, seen, false) as CanonicalJsonValue);
      }
      for (const key of Reflect.ownKeys(value)) {
        if (key === 'length') continue;
        if (typeof key === 'symbol') throw new Error(`${path} contains a symbol-keyed array property`);
        if (/^(0|[1-9]\d*)$/.test(key) && Number(key) < value.length) continue;
        throw new Error(`${path} contains non-index array property '${key}'`);
      }
      return output;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error(`${path} contains a non-plain object`);
    }

    const output: Record<string, CanonicalJsonValue> = {};
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const normalizedKeys = new Map<string, string>();
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key === 'symbol') throw new Error(`${path} contains a symbol-keyed property`);
      const descriptor = descriptors[key];
      if (!descriptor || !('value' in descriptor)) throw new Error(`${path}.${key} uses an accessor`);
      const normalizedKey = key.normalize('NFC');
      const previous = normalizedKeys.get(normalizedKey);
      if (previous && previous !== key) {
        throw new Error(`${path} contains normalized-key collision '${previous}'/'${key}'`);
      }
      normalizedKeys.set(normalizedKey, key);
      const child = visit(descriptor.value, `${path}.${normalizedKey}`, seen, true);
      if (child !== undefined) {
        Object.defineProperty(output, normalizedKey, {
          value: child,
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
    }
    return output;
  } finally {
    seen.delete(object);
  }
}
