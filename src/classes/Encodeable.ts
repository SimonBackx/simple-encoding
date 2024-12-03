import { EncodeContext } from "./EncodeContext.js";
import { isPatchMap } from "./Patchable.js";

export type PlainObject = string | number | { [key: string]: PlainObject } | boolean | PlainObject[] | undefined | null;

export interface Encodeable {
    encode(context: EncodeContext): PlainObject;
}

export interface TypedEncodeable<T extends PlainObject> extends Encodeable {
    encode(context: EncodeContext): T;
}

export function isEncodeable(object: any): object is Encodeable {
    if (typeof object !== "object" || object === null) {
        return false;
    }
    return typeof object.encode === 'function';
}

export type EncodableObject = Encodeable | EncodableObject[] | Map<EncodableObject & keyof any, EncodableObject> | PlainObject

/**
 * Use this method to encode an object (might be an encodeable implementation) into a decodable structure
 */
export function encodeObject(obj: EncodableObject, context: EncodeContext): PlainObject {
    if (isEncodeable(obj)) {
        return obj.encode(context);
    }

    if (typeof obj === 'symbol') {
        const key = Symbol.keyFor(obj);

        if (key) {
            return {
                $symbol: key
            };
        }
    }

    if (Array.isArray(obj)) {
        return (obj as (EncodableObject | PlainObject)[]).map((e) => {
            return encodeObject(e, context)
        });
    }
    
    if (isPatchMap(obj)) {
        // Transform into a normal object to conform to MapDecoders expected format
        const encodedObj = {}

        for (const [key, value] of obj) {
            const k: EncodableObject & keyof any = encodeObject(key, context) as any
            encodedObj[k] = encodeObject(value, context)
        }

        return {
            // No need to sort the keys of patches
            _isPatch: true,
            changes: encodedObj
        }
    }

    if (obj instanceof Map) {
        // Transform into a normal object to conform to MapDecoders expected format
        const queue: {key: string, value: PlainObject}[] = []

        for (const [key, value] of obj) {
            const k = encodeObject(key, context)
            if (typeof k !== 'string' && typeof k !== 'number') {
                throw new Error(`Map keys must be strings or numbers. Got ${k}`)
            }
            queue.push({key: k.toString(), value: encodeObject(value, context)})
        }

        // Sort queue by key to have reliable encoding
        const encodedObj = {};
        queue.sort((a, b) => sortObjectKeysForEncoding(a.key, b.key))

        for (const {key, value} of queue) {
            encodedObj[key] = value
        }

        if ((obj as any)._isPatch) {
            return {
                _isPatch: true,
                changes: encodedObj
            }
        }
        return encodedObj
    }

    if (obj === null || obj === undefined) {
        return obj;
    }

    if (typeof obj === 'object') {
        // Sort keys
        const keys = Object.keys(obj).sort(sortObjectKeysForEncoding)
        const encodedObj = {}
        for (const key of keys) {
            encodedObj[key] = encodeObject(obj[key], context)
        }
        return encodedObj
    }
    
    // Failed to decode
    return obj;
}

export function sortObjectKeysForEncoding(a: string, b: string) {
    // Always have a fixed order for certain keys, and follow with alphabetical order
    // id, name, description, ...remaining
    if (a === b) {
        return 0;
    }

    if (a === 'id') {
        return -1
    }

    if (b === 'id') {
        return 1
    }

    if (a === 'name') {
        return -1
    }

    if (b === 'name') {
        return 1
    }

    if (a === 'description') {
        return -1
    }

    if (b === 'description') {
        return 1
    }

    return a.localeCompare(b)
}