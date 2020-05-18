export interface Patchable<T, P> {
    patch(patch: T): P;
}

export function isPatchable<T>(object: T): object is T & Patchable<any, T> {
    return !!(object as any).patch;
}
