import { Encodeable } from "./Encodeable";
import { PatchableArray } from "../structs/PatchableArray";
import { AutoEncoder } from "./AutoEncoder";
import { Identifiable, IdentifiableType } from "./Identifiable";

export interface StrictPatch {}
export interface Patchable<T> {
    patch(patch: PatchType<T>): T;
}

export function isPatchable<T>(object: T): object is T & Patchable<any> {
    return !!(object as any).patch;
}

export function patchContainsChanges<B extends Encodeable & Patchable<B>, A extends PatchType<B>>(patch: A, model: B): boolean {
    const patched = model.patch(patch);
    return JSON.stringify(patched.encode()) != JSON.stringify(model.encode());
}

type ConvertArrayToPatchableArray<T> = T extends Array<infer P>
    ? P extends string
        ? PatchableArray<string, string, string>
        : P extends number
        ? PatchableArray<number, number, number>
        : P extends AutoEncoder & Patchable<P> & Identifiable
        ? PatchableArray<IdentifiableType<P>, P, PatchType<P> & Identifiable & Encodeable & Patchable<P>>
        : T
    : T;

export type PatchType<T> = T extends PatchableArray<any, any, any>
    ? never
    : {
          [P in keyof T]?: ConvertArrayToPatchableArray<T[P]>;
      };
