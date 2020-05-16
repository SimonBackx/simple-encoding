type PlainObject = string | number | { [key: string]: PlainObject } | boolean | PlainObject[] | undefined | null;

export interface Encodeable {
    latestVersion?: number;
    encode(version?: number): PlainObject;
}

export function isEncodeable(object: any): object is Encodeable {
    return !!object.encode;
}
