import { PatchableArray } from "../structs/PatchableArray";
import { AutoEncoder } from "./AutoEncoder";
import { Encodeable } from "./Encodeable";
import { EncodeContext } from "./EncodeContext";
import { NonScalarIdentifiable } from "./Identifiable";

export interface StrictPatch { }
export interface Patchable<P> {
    patch(patch: P): this;
}

export type PatchType<T> = T extends Patchable<infer P> ? P : (T | undefined)

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
        ? P extends string
        ? PatchableArray<string, string, string>
        : P extends number
        ? PatchableArray<number, number, number>
        : P extends AutoEncoder
        ? PatchableArrayAutoEncoder<P>
        : T | undefined
        : PatchType<T> | undefined)
    ;

export type PartialWithoutMethods<Base> = {
    [P in keyof Base]?: Base[P] extends Function ? never : Base[P];
};

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
            [P in Exclude<Exclude<keyof T, "id">, keyof AutoEncoder>]: T[P] extends Function ? never : ConvertArrayToPatchableArray<T[P]>;
        } & (T extends AutoEncoder & NonScalarIdentifiable<infer Id> ? NonScalarIdentifiable<Id> : {})
    );


/**
 * Helper type to fix TypeScript circular dependency by making a synonym for a patchable array for an autoencoder
 */
export type PatchableArrayAutoEncoder<P extends AutoEncoder> = P extends AutoEncoder & NonScalarIdentifiable<infer Id> ? 
    (
        PatchableArray<Id, P, AutoEncoderPatchType<P> & NonScalarIdentifiable<Id>> 
    ) 
: P[]

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
        } else {
            if (patch instanceof AutoEncoder && patch.isPut()) {
                // Instance type could be different
                return patch;
            } else {
                return obj.patch(patch);
            }
        }

    } else {
        if (Array.isArray(obj)) {
            // Check if patch is a patchable array
            if (patch instanceof PatchableArray) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return patch.applyTo(obj);
            } else {
                // What happens when an array field is set?
                // This can only happen when the autocoder is not identifieable, but
                // technically also in other cases if typescript doesn't check types
                // we just take over the new values and 'remove' all old elements
                return patch;
            }
        } else {
            if ((obj === undefined || obj === null) && patch instanceof PatchableArray) {
                // Patch on optional array: ignore if empty patch, else fake empty array patch
                if (patch.changes.length === 0) {
                    return obj;
                }
                const patched = patch.applyTo([]);
                if (patched.length === 0) {
                    // Nothing changed, keep it undefined or null
                    return obj;
                }
                // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                return patched;
            } else {
                return patch;
            }
        }
    }
}