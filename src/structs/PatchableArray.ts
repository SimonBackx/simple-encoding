import { Encodeable, isEncodeable, PlainObject } from "../classes/Encodeable";
import { Decoder } from "../classes/Decoder";
import { Data } from "../classes/Data";
import { ArrayDecoder } from "./ArrayDecoder";
import { DecodingError } from "../classes/DecodingError";
import { Patchable, isPatchable } from "../classes/Patchable";
import { Identifiable } from "../classes/Identifiable";

type PutAfter<Id, Put> = { afterId: Id | null; put: Put };
type MoveAfter<Id> = { afterId: Id | null; move: Id };
type PatchItem<Patch> = { patch: Patch };
type DeleteItem<Id> = { delete: Id };

type Change<Id, Put, Patch> = PutAfter<Id, Put> | MoveAfter<Id> | DeleteItem<Id> | PatchItem<Patch>;

function isMove(val: Change<any, any, any>): val is MoveAfter<any> {
    return (val as any).move !== undefined;
}

function isPut(val: Change<any, any, any>): val is PutAfter<any, any> {
    return (val as any).put !== undefined;
}

function isDelete(val: Change<any, any, any>): val is DeleteItem<any> {
    return (val as any).delete !== undefined;
}

function isPatch(val: Change<any, any, any>): val is PatchItem<any> {
    return (val as any).patch !== undefined;
}

function isIdentifiable(val: any): val is Identifiable<any> {
    return (val as any).getIdentifier !== undefined;
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
export class PatchableArray<
    Id extends string | number,
    Put extends (Identifiable<Id> & Encodeable & Patchable<Patch, Put>) | Id,
    Patch extends (Identifiable<Id> & Encodeable & Patchable<Patch, Patch>) | Put
> implements Encodeable {
    changes: Change<Id, Put, Patch>[];

    constructor(changes?: Change<Id, Put, Patch>[]) {
        this.changes = changes ?? [];
    }

    put(value: Put, after: Id | null) {
        this.changes.push({ afterId: after, put: value });
    }

    move(item: Id, after: Id | null) {
        this.changes.push({ afterId: after, move: item });
    }

    patch(value: Patch) {
        // todo: check if we have other patches and merge them
        // todo: check if we have puts, and merge them
        this.changes.push({ patch: value });
    }

    delete(id: Id) {
        // todo: remove all puts and patches
        // if it had a put, remove the put but don't add a delete
        this.changes.push({ delete: id });
    }

    /// Apply patch changes to a given array
    applyTo(array: Put[]): Put[] {
        const newArray = array.slice(0);

        for (const change of this.changes) {
            // Apply this change
            if (isMove(change)) {
                // First do a delete of this value
                const index = newArray.findIndex((e) => getId(e) == change.move);

                if (index != -1) {
                    const value = newArray[index];
                    newArray.splice(index, 1);
                    // Insert it again

                    // null = inserting at the beginning
                    // not found = inserting at the end
                    let afterIndex = -1;
                    if (change.afterId !== null) {
                        newArray.findIndex((e) => getId(e) == change.afterId);
                        if (afterIndex == -1) {
                            afterIndex = newArray.length - 1;
                        }
                    }
                    newArray.splice(afterIndex + 1, 0, value);
                } else {
                    // maybe throw here?
                }
            } else if (isPut(change)) {
                // null = inserting at the beginning
                // not found = inserting at the end
                let afterIndex = -1;
                if (change.afterId !== null) {
                    afterIndex = newArray.findIndex((e) => getId(e) == change.afterId);
                    if (afterIndex == -1) {
                        afterIndex = newArray.length - 1;
                    }
                }
                newArray.splice(afterIndex + 1, 0, change.put);
            } else if (isDelete(change)) {
                // First do a delete of this value
                const index = newArray.findIndex((e) => getId(e) == change.delete);
                if (index != -1) {
                    newArray.splice(index, 1);
                }
            } else if (isPatch(change)) {
                // First do a delete of this value
                const index = newArray.findIndex((e) => getId(e) == getId(change.patch));

                if (index != -1) {
                    // Patch!
                    const value = newArray[index];
                    if (isPatchable(value)) {
                        newArray.splice(index, 1, value.patch(change.patch));
                    } else {
                        newArray.splice(index, 1, change.patch as Put);
                    }
                }
            } else {
                throw new Error("Invalid change: " + JSON.stringify(change));
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
                } else if (isPut(change)) {
                    // First do a delete of this value
                    return {
                        afterId: change.afterId as string | number,
                        insert: isEncodeable(change.put) ? change.put.encode() : (change.put as string | number),
                    };
                } else if (isDelete(change)) {
                    return {
                        delete: (change.delete as string | number) as string | number,
                    };
                } else if (isPatch(change)) {
                    // First do a delete of this value
                    return {
                        patch: isEncodeable(change.patch) ? change.patch.encode() : (change.patch as string | number),
                    };
                }
            }
        );
    }
}

export class PatchableArrayItemDecoder<
    Id extends string | number,
    Put extends (Identifiable<Id> & Encodeable & Patchable<Patch, Put>) | Id,
    Patch extends (Identifiable<Id> & Encodeable & Patchable<Patch, Patch>) | Put
> implements Decoder<Change<Id, Put, Patch>> {
    putDecoder: Decoder<Put>;
    patchDecoder: Decoder<Patch>;
    idDecoder: Decoder<Id>;

    constructor(putDecoder: Decoder<Put>, patchDecoder: Decoder<Patch>, idDecoder: Decoder<Id>) {
        this.putDecoder = putDecoder;
        this.patchDecoder = patchDecoder;
        this.idDecoder = idDecoder;
    }
    decode(data: Data): Change<Id, Put, Patch> {
        try {
            const put = {
                put: data.field("put").decode(this.putDecoder),
                afterId: data.field("afterId").decode(this.idDecoder),
            };
            return put;
        } catch (e) {}

        try {
            const move = {
                move: data.field("move").decode(this.idDecoder),
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

        try {
            const p = {
                patch: data.field("patch").decode(this.patchDecoder),
            };
            return p;
        } catch (e) {}

        throw new DecodingError({
            code: "invalid_field",
            message: "Expected an insert, move, patch or delete",
            field: data.currentField,
        });
    }
}

export class PatchableArrayDecoder<
    Id extends string | number,
    Put extends (Identifiable<Id> & Encodeable & Patchable<Patch, Put>) | Id,
    Patch extends (Identifiable<Id> & Encodeable & Patchable<Patch, Patch>) | Put
> implements Decoder<PatchableArray<Id, Put, Patch>> {
    putDecoder: Decoder<Put>;
    patchDecoder: Decoder<Patch>;
    idDecoder: Decoder<Id>;

    constructor(putDecoder: Decoder<Put>, patchDecoder: Decoder<Patch>, idDecoder: Decoder<Id>) {
        this.putDecoder = putDecoder;
        this.patchDecoder = patchDecoder;
        this.idDecoder = idDecoder;
    }

    decode(data: Data): PatchableArray<Id, Put, Patch> {
        return new PatchableArray<Id, Put, Patch>(data.array(new PatchableArrayItemDecoder(this.putDecoder, this.patchDecoder, this.idDecoder)));
    }
}
