export interface BaseIdentifiable<Id> {
    getIdentifier(): Id;
}

export type Identifiable = BaseIdentifiable<string | number> | { id: string | number } | string | number;

export type IdentifiableType<T extends Identifiable> = T extends string | number
    ? T
    : T extends { id: infer P }
    ? P extends string | number
        ? P
        : never
    : T extends BaseIdentifiable<infer P>
    ? P extends string | number
        ? P
        : never
    : never;

export function isBaseIdentifiable(val: any): val is BaseIdentifiable<any> {
    return (val as any).getIdentifier !== undefined;
}

function hasId(val: any): val is { id: string | number } {
    return (val as any).id !== undefined;
}

export function getId(val: Identifiable): string | number {
    if (isBaseIdentifiable(val)) {
        return val.getIdentifier();
    }
    if (hasId(val)) {
        return val.id;
    }
    return val;
}
