import { PatchableArray } from '../structs/PatchableArray.js';
import { AutoEncoder, isAutoEncoder } from './AutoEncoder.js';
import { Encodeable } from './Encodeable.js';
import { EncodeContext } from './EncodeContext.js';
import { NonScalarIdentifiable } from './Identifiable.js';
import { Cloneable, cloneObject } from './Cloneable.js';

export interface StrictPatch { }
export interface Patchable<P> {
    patch(patch: P): this;
}

export type PatchType<T> = T extends Patchable<infer P> ? P : (T | undefined);

export function isPatchable<T>(object: T): object is T & Patchable<any> {
    if (!object) {
        return false;
    }
    return !!(object as any).patch;
}

export function patchContainsChanges<B extends Encodeable & Patchable<B>, A extends PatchType<B>>(patch: A, model: B, context: EncodeContext): boolean {
    const patched = model.patch(patch);
    return JSON.stringify(patched.encode(context)) != JSON.stringify(model.encode(context));
}

export type ConvertArrayToPatchableArray<T> =
    T extends AutoEncoder ?
        T | AutoEncoderPatchType<T> | undefined // This is needed to help Typescript Understand to keep T instead of just generalizing to AutoEncoderPatchType<AutoEncoder>
        : T extends PatchableArray<any, any, any>
            ? T :
                (T extends Array<infer P>
                    ? (P extends string
                            ? PatchableArray<string, string, string>
                            : P extends number
                                ? PatchableArray<number, number, number>
                                : P extends AutoEncoder
                                    ? PatchableArrayAutoEncoder<P>
                                    : T | undefined)
                    : (
                            T extends Map<infer T, infer P> ?
                                    (/* Map<T, P> | */ PatchMap<T, P | ConvertArrayToPatchableArray<P> | null>)
                                : PatchType<T> | undefined
                        ))
    ;

type NonMethodKeys<T> = {
    [K in keyof T]: T[K] extends Function ? never : K
}[keyof T];

export type PartialWithoutMethods<Base> = Partial<Pick<Base, NonMethodKeys<Base>>>;

type GetOptionalPropertiesOfHelper<Base> = {
    [Key in keyof Base]: Base[Key] extends string | number | Array<any> | Function | boolean | Record<string, any> ? never : Key;
};
type GetOptionalPropertiesOf<Base> = Exclude<GetOptionalPropertiesOfHelper<Base>[keyof Base], undefined>;

type MakeOptionalRealOptionalHelper<Base> = {
    [Key in GetOptionalPropertiesOf<Base>]?: Base[Key];
} &
{
    [Key in Exclude<keyof Base, GetOptionalPropertiesOf<Base>>]: Base[Key];
};
type MakeOptionalRealOptional<Base> = {
    [Key in keyof MakeOptionalRealOptionalHelper<Base>]: Base[Key];
};

/**
 * Automatically determine the patchtype of an autoencoder object
 */

/**
 * Automatically determine the patchtype of an autoencoder object
 */
export type AutoEncoderPatchType<T extends AutoEncoder> =
    AutoEncoder & (
        {
            [P in Exclude<Exclude<keyof T, 'id'>, keyof AutoEncoder>]: T[P] extends Function ? never : ConvertArrayToPatchableArray<T[P]>;
        } & (T extends NonScalarIdentifiable<infer Id> ? NonScalarIdentifiable<Id> : {})
    );

/**
 * Helper type to fix TypeScript circular dependency by making a synonym for a patchable array for an autoencoder
 */
export type PatchableArrayAutoEncoder<P extends AutoEncoder> = P extends AutoEncoder & NonScalarIdentifiable<infer Id> ?
        (
            PatchableArray<Id, P, AutoEncoderPatchType<P> & NonScalarIdentifiable<Id>>
        )
    : P[];

export class PatchMap<K, V> extends Map<K, V> implements Cloneable {
    _isPatch = true;
    _isPatchMap = true;

    applyTo(obj: Map<any, any>) {
        if (isPatchMap(obj)) {
            // Combine instead of normal logic
            const clone = new PatchMap(obj);

            for (const [key, value] of this.entries()) {
                if (value === null) {
                    clone.set(key, null);
                    continue;
                }

                if (value === undefined) {
                    continue;
                }

                const original = obj.get(key);

                if (original === null) {
                    // Has been deleted higher up
                    if (isPatch(value)) {
                        continue;
                    }
                    clone.set(key, value);
                    continue;
                }

                if (original === undefined) {
                    clone.set(key, value);
                    continue;
                }

                clone.set(key, patchObject(original, value));
            }
            return clone;
        }

        const clone = new Map(obj);

        for (const [key, value] of this.entries()) {
            if (value === null) {
                clone.delete(key);
                continue;
            }

            if (value === undefined) {
                continue;
            }

            const original = obj.get(key);
            const patched = patchObject(original, value);

            if (original === undefined && patched === undefined) {
                // Don't copy it: this is an empty patch to an item that does not exist
                continue;
            }
            clone.set(key, patched);
        }
        return clone;
    }

    clone<T extends this>(this: T): this {
        // Deep clone self
        const clone = new PatchMap<K, V>() as this;
        for (const [key, value] of this.entries()) {
            clone.set(key, cloneObject(value as any));
        }
        return clone;
    }
}

export function isPatchMap(obj: unknown): obj is PatchMap<any, any> {
    return (obj instanceof PatchMap);
}

export function isPatchableArray(obj: unknown): obj is PatchableArray<any, any, any> {
    return (obj instanceof PatchableArray);
}

export function isPatch(obj: unknown) {
    if (isAutoEncoder(obj)) {
        // Instance type could be different
        return obj.isPatch();
    }

    if (isPatchMap(obj)) {
        return true;
    }

    if (isPatchableArray(obj)) {
        return true;
    }

    return false;
}

export function isEmptyPatch(patch: unknown) {
    if (patch === undefined) {
        return true;
    }

    if (patch === null) {
        return false;
    }

    if (Array.isArray(patch)) {
        // Can override array
        return false;
    }

    if (isPatchableArray(patch)) {
        return patch.changes.length === 0;
    }

    if (isPatchMap(patch)) {
        return patch.size === 0;
    }

    if (patch instanceof Map) {
        return false;
    }

    if (typeof patch === 'object') {
        if (Object.keys(patch).length === 0) {
            return true;
        }
        return false;
    }

    return false;
}

/**
 * Use this method to encode an object (might be an encodeable implementation) into a decodable structure
 */
export function patchObject(obj: unknown, patch: unknown): any {
    if (patch === undefined) {
        // When a property is set to undefined, we always ignore it, always. You can never set something to undefined.
        // Use null instead.
        return obj;
    }

    if (isPatchable(obj)) {
        if (patch == null) {
            return null;
        }
        else {
            if (isAutoEncoder(patch) && patch.isPut()) {
                // Instance type could be different
                return patch;
            }
            else {
                return obj.patch(patch);
            }
        }
    }
    else {
        if (obj instanceof Map && isPatchMap(patch)) {
            return patch.applyTo(obj);
        }
        else if (Array.isArray(obj)) {
            // Check if patch is a patchable array
            if (isPatchableArray(patch)) {
                return patch.applyTo(obj);
            }
            else {
                // What happens when an array field is set?
                // This can only happen when the autocoder is not identifieable, but
                // technically also in other cases if typescript doesn't check types
                // we just take over the new values and 'remove' all old elements
                return patch;
            }
        }
        else {
            if ((obj === undefined || obj === null) && isPatchableArray(patch)) {
                // Patch on optional array: ignore if empty patch, else fake empty array patch
                if (patch.changes.length === 0) {
                    return obj;
                }
                const patched = patch.applyTo([]);
                if (patched.length === 0) {
                    // Nothing changed, keep it undefined or null
                    return obj;
                }

                return patched;
            }
            else if ((obj === undefined || obj === null) && isPatchMap(patch)) {
                // Patch on optional array: ignore if empty patch, else fake empty array patch
                if (patch.size === 0) {
                    return obj;
                }
                const patched = patch.applyTo(new Map());
                if (patched.size === 0) {
                    // Nothing changed, keep it undefined or null
                    return obj;
                }

                return patched;
            }
            else {
                return patch;
            }
        }
    }
}
