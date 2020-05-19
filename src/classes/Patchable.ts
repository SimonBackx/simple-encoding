import { Encodeable } from "./Encodeable";

export interface Patchable<T, P> {
    patch(patch: T): P;
}

export function isPatchable<T>(object: T): object is T & Patchable<any, T> {
    return !!(object as any).patch;
}

export function patchContainsChanges<A, B extends Encodeable & Patchable<A, B>>(patch: A, model: B): boolean {
    const patched = model.patch(patch);
    return JSON.stringify(patched.encode()) != JSON.stringify(model.encode());
}
