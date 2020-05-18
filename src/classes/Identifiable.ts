export interface BaseIdentifiable<Id> {
    getIdentifier(): Id;
}

export type Identifiable = BaseIdentifiable<string | number> | { id: string | number } | string | number;

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
