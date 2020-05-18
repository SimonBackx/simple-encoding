export interface Patchable<T> {
    patch(patch: T): this;
}

export function isPatchable(object: any): object is Patchable<any> {
    return !!object.patch;
}
