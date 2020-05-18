import { Encodeable, isEncodeable, PlainObject } from "../classes/Encodeable";
import { Decoder } from "../classes/Decoder";
import { Data } from "../classes/Data";
import { ArrayDecoder } from "./ArrayDecoder";
import { DecodingError } from "../classes/DecodingError";

type InsertAfter<Id, Value> = { afterId: Id; insert: Value };
type MoveAfter<Id, Value> = { afterId: Id; move: Value };
type Delete<Id> = { delete: Id };

type Change<Id, Value> = InsertAfter<Id, Value> | MoveAfter<Id, Value> | Delete<Id>;

function isMove(val: Change<any, any>): val is MoveAfter<any, any> {
    return (val as any).move !== undefined;
}

function isInsert(val: Change<any, any>): val is InsertAfter<any, any> {
    return (val as any).insert !== undefined;
}

function isDelete(val: Change<any, any>): val is Delete<any> {
    return (val as any).delete !== undefined;
}

function isIdentifiable(val: any): val is Identifiable<any> {
    return (val as any).getIdentifier !== undefined;
}

interface Identifiable<Id> {
    getIdentifier(): Id;
}

function getId<Id>(val: Identifiable<Id> | Id): Id {
    if (isIdentifiable(val)) {
        return val.getIdentifier();
    }
    return val;
}

/**
 * Helps with synchronizing changes to an array. As long as every element in the array has a unique identifier.
 */
export class PatchableArray<Id extends string | number, Value extends (Identifiable<Id> & Encodeable) | Id> implements Encodeable {
    changes: Change<Id, Value>[];

    constructor(changes?: Change<Id, Value>[]) {
        this.changes = changes ?? [];
    }

    insert(after: Id, value: Value) {
        this.changes.push({ afterId: after, insert: value });
    }

    move(after: Id, value: Value) {
        this.changes.push({ afterId: after, move: value });
    }

    delete(id: Id) {
        this.changes.push({ delete: id });
    }

    /// Apply patch changes to a given array
    applyTo(array: Value[]): Value[] {
        const newArray = array.slice(0);

        for (const change of this.changes) {
            // Apply this change
            if (isMove(change)) {
                // First do a delete of this value
                const index = newArray.findIndex((e) => getId(e) == getId(change.move));
                if (index != -1) {
                    newArray.splice(index, 1);
                }
                // Insert it again
                let afterIndex = newArray.findIndex((e) => getId(e) == change.afterId);
                if (afterIndex == -1) {
                    afterIndex = newArray.length - 1;
                }
                newArray.splice(afterIndex + 1, 0, change.move);
            } else if (isInsert(change)) {
                let afterIndex = newArray.findIndex((e) => getId(e) == change.afterId);
                if (afterIndex == -1) {
                    afterIndex = newArray.length - 1;
                }
                newArray.splice(afterIndex + 1, 0, change.insert);
            } else if (isDelete(change)) {
                // First do a delete of this value
                const index = newArray.findIndex((e) => getId(e) == change.delete);
                if (index != -1) {
                    newArray.splice(index, 1);
                }
            }
        }

        return newArray;
    }

    encode() {
        return this.changes.map(
            (change): PlainObject => {
                if (isMove(change)) {
                    // First do a delete of this value
                    return {
                        afterId: change.afterId as string | number,
                        move: isEncodeable(change.move) ? change.move.encode() : (change.move as string | number),
                    };
                } else if (isInsert(change)) {
                    // First do a delete of this value
                    return {
                        afterId: change.afterId as string | number,
                        insert: isEncodeable(change.insert) ? change.insert.encode() : (change.insert as string | number),
                    };
                } else if (isDelete(change)) {
                    return {
                        delete: (change.delete as string | number) as string | number,
                    };
                }
            }
        );
    }
}

export class PatchableArrayItemDecoder<Id extends string | number, Value extends (Identifiable<Id> & Encodeable) | Id> implements Decoder<Change<Id, Value>> {
    valueDecoder: Decoder<Value>;
    idDecoder: Decoder<Id>;

    constructor(valueDecoder: Decoder<Value>, idDecoder: Decoder<Id>) {
        this.valueDecoder = valueDecoder;
        this.idDecoder = idDecoder;
    }
    decode(data: Data): Change<Id, Value> {
        try {
            const insert = {
                insert: data.field("insert").decode(this.valueDecoder),
                afterId: data.field("afterId").decode(this.idDecoder),
            };
            return insert;
        } catch (e) {}

        try {
            const move = {
                move: data.field("move").decode(this.valueDecoder),
                afterId: data.field("afterId").decode(this.idDecoder),
            };
            return move;
        } catch (e) {}

        try {
            const d = {
                delete: data.field("delete").decode(this.idDecoder),
            };
            return d;
        } catch (e) {}

        throw new DecodingError({
            code: "invalid_field",
            message: "Expected an insert, move or delete",
            field: data.currentField,
        });
    }
}

export class PatchableArrayDecoder<Id extends string | number, Value extends (Identifiable<Id> & Encodeable) | Id>
    implements Decoder<PatchableArray<Id, Value>> {
    valueDecoder: Decoder<Value>;
    idDecoder: Decoder<Id>;

    constructor(valueDecoder: Decoder<Value>, idDecoder: Decoder<Id>) {
        this.valueDecoder = valueDecoder;
        this.idDecoder = idDecoder;
    }
    decode(data: Data): PatchableArray<Id, Value> {
        return new PatchableArray<Id, Value>(data.array(new PatchableArrayItemDecoder(this.valueDecoder, this.idDecoder)));
    }
}
