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
    return !!object.encode;
}

export type EncodableObject = Encodeable | EncodableObject[] | Map<EncodableObject & keyof any, EncodableObject> | PlainObject


/**
 * Use this method to encode an object (might be an encodeable implementation) into a decodable structure
 */
export function encodeObject(obj: EncodableObject, context: EncodeContext): PlainObject {
    if (isEncodeable(obj)) {
        return obj.encode(context);
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
            _isPatch: true,
            changes: encodedObj
        }
    }

    if (obj instanceof Map) {
        // Transform into a normal object to conform to MapDecoders expected format
        const encodedObj = {}

        for (const [key, value] of obj) {
            const k: EncodableObject & keyof any = encodeObject(key, context) as any
            encodedObj[k] = encodeObject(value, context)
        }

        if ((obj as any)._isPatch) {
            return {
                _isPatch: true,
                changes: encodedObj
            }
        }
        return encodedObj
    }
    
    // Failed to decode
    return obj;
}