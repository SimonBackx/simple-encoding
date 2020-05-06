type PlainObject = string | number | { [key: string]: PlainObject } | boolean | PlainObject[];

export interface Encodeable {
    encode(): PlainObject;
}

export function isEncodeable(object: any): object is Encodeable {
    return !!object.encode;
}
