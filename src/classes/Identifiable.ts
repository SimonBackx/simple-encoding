export interface BaseIdentifiable<Id extends string | number> {
    getIdentifier(): Id;
}

export type NonScalarIdentifiable<P extends string | number> = { id: P };
export type Identifiable<P extends string | number> = BaseIdentifiable<P> | NonScalarIdentifiable<P>;

/*export type IdentifiableType<T extends Identifiable> = T extends string | number
    ? T
    : T extends { id: infer P }
    ? P extends string | number
        ? P
        : never
    : T extends BaseIdentifiable<infer P>
    ? P extends string | number
        ? P
        : never
    : never;*/

export type NonScalarIdentifiableType<T> = T extends { id: infer P }
    ? P extends string | number
        ? P
        : never
    : never;

export function isBaseIdentifiable(val: any): val is BaseIdentifiable<any> {
    return val.getIdentifier !== undefined;
}

function hasId(val: any): val is { id: string | number } {
    return val.id !== undefined;
}

export function getId<P extends string | number>(val: Identifiable<P> | P): P {
    if (isBaseIdentifiable(val)) {
        return val.getIdentifier();
    }
    if (hasId(val)) {
        return val.id;
    }
    return val;
}
