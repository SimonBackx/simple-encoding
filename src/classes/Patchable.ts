import { PatchableArray } from "../structs/PatchableArray";
import { AutoEncoder } from "./AutoEncoder";
import { Encodeable } from "./Encodeable";
import { EncodeContext } from "./EncodeContext";
import { BaseIdentifiable, Identifiable, NonScalarIdentifiable } from "./Identifiable";

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

type RemoveMethodsHelper<Base> = {
    [Key in keyof Base]: Base[Key] extends Function ? never : Key;
};
type NonMethodNames<Base> = Exclude<RemoveMethodsHelper<Base>[keyof Base], undefined>;

export type PartialWithoutMethods<Base> = {
    [P in NonMethodNames<Base>]?: Base[P];
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
    (
        T extends BaseIdentifiable<infer Id> ? (
            {
                [P in NonMethodNames<T>]: ConvertArrayToPatchableArray<T[P]>;
            } & BaseIdentifiable<Id>
        ) : (
            {
                [P in Exclude<NonMethodNames<T>, "id">]: ConvertArrayToPatchableArray<T[P]>;
            } & (T extends NonScalarIdentifiable<infer Id> ? NonScalarIdentifiable<Id> : {})
        )
    ) & AutoEncoder;
// -> BaseIdentifiable and NonScalarIdentifiable is split up, because identifiable type needs to stay the same

/**
 * Helper type to fix TypeScript circular dependency by making a synonym for a patchable array for an autoencoder
 */
export type PatchableArrayAutoEncoder<P extends AutoEncoder> = P extends BaseIdentifiable<infer Id> ? 
    (
        PatchableArray<Id, P, AutoEncoderPatchType<P> & BaseIdentifiable<Id>> 
    ) 
: (P extends NonScalarIdentifiable<infer Id> ? 
    (
        PatchableArray<Id, P, AutoEncoderPatchType<P> & NonScalarIdentifiable<Id>> 
    ) 
: P[])
