import { Encodeable, isEncodeable, PlainObject } from "../classes/Encodeable";
import { Decoder } from "../classes/Decoder";
import { Data } from "../classes/Data";
import { DecodingError } from "../classes/DecodingError";
import { PatchType, Patchable, isPatchable } from "../classes/Patchable";
import { Identifiable, getId, NonScalarIdentifiable } from "../classes/Identifiable";
import { EncodeContext } from "../classes/EncodeContext";

type PutAfter<Id, Put> = { afterId?: Id | null; put: Put };
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

/**
 * Helps with synchronizing changes to an array. As long as every element in the array has a unique identifier.
 */
export class PatchableArray<
    Id extends string | number,
    Put extends (Identifiable & Encodeable & Patchable<Put>) | Id,
    Patch extends (Identifiable & Encodeable & Patchable<Patch> & PatchType<Put>) | Put
> implements Encodeable, Patchable<PatchableArray<Id, Put, Patch>> {
    changes: Change<Id, Put, Patch>[];

    constructor(changes?: Change<Id, Put, Patch>[]) {
        this.changes = changes ?? [];
    }

    clone(): PatchableArray<Id, Put, Patch> {
        // Deep clone self
        const cloned = new PatchableArray<Id, Put, Patch>();
        cloned.merge(this);
        return cloned;
    }

    merge(other: PatchableArray<Id, Put, Patch>) {
        for (const change of other.changes) {
            this.changes.push(Object.assign({}, change));
        }
    }

    patch(patch: PatchableArray<Id, Put, Patch>): PatchableArray<Id, Put, Patch> {
        // Deep clone self
        const cloned = this.clone();

        for (const change of patch.changes) {
            // Apply this change
            if (isMove(change)) {
                cloned.addMove(change.move, change.afterId);
            } else if (isPut(change)) {
                cloned.addPut(change.put, change.afterId);
            } else if (isDelete(change)) {
                cloned.addDelete(change.delete);
            } else if (isPatch(change)) {
                cloned.addPatch(change.patch);
            } else {
                throw new Error("Invalid change: " + JSON.stringify(change));
            }
        }

        return cloned;
    }

    addPut(value: Put, after?: Id | null) {
        this.changes.push({ afterId: after, put: value });
    }

    addMove(item: Id, after: Id | null) {
        this.changes.push({ afterId: after, move: item });
    }

    filter(item: Id): PatchableArray<Id, Put, Patch> {
        const construct = this.constructor as typeof PatchableArray;
        const n: PatchableArray<Id, Put, Patch> = new construct();

        const newCurrentChanges: Change<Id, Put, Patch>[] = [];

        for (const change of this.changes) {
            if (isMove(change)) {
                newCurrentChanges.push(change);
            } else if (isPut(change)) {
                if (getId(change.put) == item) {
                    n.changes.push(change);
                } else {
                    newCurrentChanges.push(change);
                }
            } else if (isDelete(change)) {
                if (change.delete == item) {
                    n.changes.push(change);
                } else {
                    newCurrentChanges.push(change);
                }
            } else if (isPatch(change)) {
                if (getId(change.patch) == item) {
                    n.changes.push(change);
                } else {
                    newCurrentChanges.push(change);
                }
            } else {
                throw new Error("Invalid change: " + JSON.stringify(change));
            }
        }

        this.changes = newCurrentChanges;
        return n;
    }

    addPatch(value: Patch) {
        const id = getId(value);
        const otherPut = this.changes.findIndex((e) => isPut(e) && getId(e.put) == id);
        if (otherPut !== -1) {
            const other: PutAfter<Id, Put> = this.changes[otherPut] as any;

            if (isPatchable(other.put)) {
                this.changes.splice(otherPut, 1, {
                    put: other.put.patch(value as any),
                    afterId: other.afterId,
                });
            } else {
                this.changes.splice(otherPut, 1, {
                    put: value as Put,
                    afterId: other.afterId,
                });
            }
            return;
        }

        const otherPatch = this.changes.findIndex((e) => isPatch(e) && getId(e.patch) == id);
        if (otherPatch !== -1) {
            const other: PatchItem<Patch> = this.changes[otherPatch] as any;

            if (isPatchable(other.patch)) {
                this.changes.splice(otherPatch, 1, {
                    patch: other.patch.patch(value as any),
                });
            } else {
                this.changes.splice(otherPatch, 1, {
                    patch: value,
                });
            }
            return;
        }

        this.changes.push({ patch: value });
    }

    addDelete(id: Id) {
        // Remove all puts, patches and moves
        const otherPut = this.changes.findIndex((e) => isPut(e) && getId(e.put) == id);
        if (otherPut !== -1) {
            // if it had a put, remove the put but don't add a delete
            this.changes.splice(otherPut, 1);
            return;
        } else {
            const otherPatch = this.changes.findIndex((e) => isPatch(e) && getId(e.patch) == id);
            if (otherPatch !== -1) {
                this.changes.splice(otherPatch, 1);
            }
        }

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
                        afterIndex = newArray.findIndex((e) => getId(e) == change.afterId);
                        if (afterIndex == -1) {
                            afterIndex = newArray.length - 1;
                        }
                    }
                    newArray.splice(afterIndex + 1, 0, value);
                } else {
                    // maybe throw here?
                    console.warn("Could not find element with id " + change.move);
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
                if (change.afterId === undefined) {
                    afterIndex = newArray.length - 1;
                }
                newArray.splice(afterIndex + 1, 0, change.put);
            } else if (isDelete(change)) {
                // First do a delete of this value
                const index = newArray.findIndex((e) => getId(e) == change.delete);
                if (index != -1) {
                    newArray.splice(index, 1);
                } else {
                    console.warn("Could not find element with id " + change.delete);
                }
            } else if (isPatch(change)) {
                // First do a delete of this value
                const index = newArray.findIndex((e) => getId(e) == getId(change.patch));

                if (index != -1) {
                    // Patch!
                    const value = newArray[index];
                    if (isPatchable(value)) {
                        newArray.splice(index, 1, value.patch(change.patch as any));
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

    encode(context: EncodeContext) {
        return this.changes.map(
            (change): PlainObject => {
                if (isMove(change)) {
                    // First do a delete of this value
                    return {
                        afterId: change.afterId,
                        move: isEncodeable(change.move) ? change.move.encode(context) : change.move,
                    };
                } else if (isPut(change)) {
                    // First do a delete of this value
                    return {
                        afterId: change.afterId,
                        put: isEncodeable(change.put) ? change.put.encode(context) : (change.put as string | number),
                    };
                } else if (isDelete(change)) {
                    return {
                        delete: change.delete,
                    };
                } else if (isPatch(change)) {
                    // First do a delete of this value
                    return {
                        patch: isEncodeable(change.patch) ? change.patch.encode(context) : (change.patch as string | number),
                    };
                }
            }
        );
    }

    getPuts(): PutAfter<Id, Put>[] {
        return this.changes.filter((change) => isPut(change)) as PutAfter<Id, Put>[];
    }

    getPatches(): Patch[] {
        return this.changes.filter((change) => isPatch(change)).map((p: PatchItem<Patch>) => p.patch);
    }

    getDeletes(): Id[] {
        return this.changes.filter((change) => isDelete(change)).map((p: DeleteItem<Id>) => p.delete);
    }

    getMoves(): MoveAfter<Id>[] {
        return this.changes.filter((change) => isMove(change)) as MoveAfter<Id>[];
    }
}

export class PatchableArrayItemDecoder<
    Id extends string | number,
    Put extends (Identifiable & Encodeable & Patchable<Put>) | Id,
    Patch extends (Identifiable & Encodeable & Patchable<Patch> & PatchType<Put>) | Put
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
        const put = data.optionalField("put");
        if (put !== undefined) {
            // throw decoding errors from putDecoder and idDecoder
            return {
                put: put.decode(this.putDecoder),
                afterId: data.undefinedField("afterId")?.nullable(this.idDecoder),
            };
        }

        const move = data.optionalField("move");
        if (move !== undefined) {
            return {
                move: move.decode(this.idDecoder),
                afterId: data.field("afterId").nullable(this.idDecoder),
            };
        }

        const d = data.optionalField("delete");
        if (d !== undefined) {
            return {
                delete: d.decode(this.idDecoder),
            };
        }

        const patch = data.optionalField("patch");
        if (patch !== undefined) {
            return {
                patch: patch.decode(this.patchDecoder),
            };
        }

        throw new DecodingError({
            code: "invalid_field",
            message: "Expected put, move, patch or delete",
            field: data.currentField,
        });
    }
}

export class PatchableArrayDecoder<
    Id extends string | number,
    Put extends (Identifiable & Encodeable & Patchable<Put>) | Id,
    Patch extends (Identifiable & Encodeable & Patchable<Patch> & PatchType<Put>) | Put
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
