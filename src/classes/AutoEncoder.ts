import { Decoder } from "./Decoder";
import { Encodeable, PlainObject, isEncodeable } from "./Encodeable";
import { Data } from "./Data";
import { field } from "../decorators/Field";
import { Patchable, isPatchable, PatchType, PartialWithoutMethods } from "./Patchable";
import { Identifiable } from "./Identifiable";
import { PatchableArray, PatchableArrayDecoder } from "../structs/PatchableArray";
import { ArrayDecoder } from "../structs/ArrayDecoder";
import StringDecoder from "../structs/StringDecoder";
import { EncodeContext } from "./EncodeContext";

export class Field {
    optional: boolean;
    nullable: boolean;
    decoder: Decoder<any>;

    /**
     * Version in which this field was added
     */
    version: number;

    /**
     * Name of the property where to save / get this value
     */
    property: string;

    /**
     * Name in the encoded version
     */
    field: string;

    /**
     * Internal value for unsupported versions
     */
    defaultValue?: () => any;

    getOptionalClone() {
        const field = new Field();
        field.optional = true;
        field.nullable = this.optional;
        field.decoder = this.decoder;
        field.version = this.version;
        field.property = this.property;
        field.field = this.field;
        field.defaultValue = undefined; // do not copy default values. Patches never have default values!

        if (this.decoder instanceof ArrayDecoder) {
            const elementDecoder = this.decoder.decoder;
            if ((elementDecoder as any).patchType) {
                const patchType = (elementDecoder as any).patchType();
                const idFieldType = (elementDecoder as typeof AutoEncoder).fields.find((field) => field.property == "id")!.decoder;

                field.decoder = new PatchableArrayDecoder(elementDecoder, patchType, idFieldType);
                field.defaultValue = () => new PatchableArray<any, any, any>();
            } else {
                field.decoder = new PatchableArrayDecoder(elementDecoder, elementDecoder, elementDecoder);
                field.defaultValue = () => new PatchableArray<any, any, any>();
            }
        }

        return field;
    }
}

type AutoEncoderConstructorNames<T> = { [K in keyof T]: T[K] extends Function | PatchableArray<any, any, any> ? never : K }[Exclude<keyof T, "latestVersion">];
export type AutoEncoderConstructor<T> = Pick<T, AutoEncoderConstructorNames<T>>;

/**
 * Create patchable auto encoder.
 * We are not able to add types here, gets too complex. But we'll add a convenience method with typings
 */
export function createPatchableAutoEncoder(constructor: typeof AutoEncoder): typeof AutoEncoder {
    return constructor as any;
}
/*
class Dog extends AutoEncoder {
    id: string;
    name: string;
}

const DogPatch = createPatchableAutoEncoder(Dog);

const p = DogPatch.create({id: "test"})

*/

export class AutoEncoder implements Encodeable {
    /// Fields should get sorted by version. Low to high
    static fields: Field[];
    private static cachedPatchType?: typeof AutoEncoder;

    /// Create a patch for this instance (of reuse if already created)
    static patchType<T extends typeof AutoEncoder>(this: T): typeof AutoEncoder & (new (...args: any[]) => PatchType<InstanceType<T>>) {
        if (this.cachedPatchType) {
            return this.cachedPatchType as any;
        }
        // create a new class
        class CreatedPatch extends AutoEncoder {}
        CreatedPatch.fields = [];

        // A patchtype of a patchtype is always the same
        // -> avoids infinite loop and allows recursive encoding
        CreatedPatch.cachedPatchType = CreatedPatch;
        this.cachedPatchType = CreatedPatch;

        // Move over all fields
        for (const field of this.fields) {
            CreatedPatch.fields.push(field.getOptionalClone());
        }

        return CreatedPatch as any;
    }

    constructor() {
        if (!this.static.fields) {
            this.static.fields = [];
        }

        for (const field of this.static.fields) {
            if (field.defaultValue) {
                this[field.property] = field.defaultValue();
            }
        }
    }

    patch<T extends AutoEncoder>(this: T, patch: PatchType<T>): T {
        const instance = new this.static() as T;
        for (const field of this.static.fields) {
            const prop = field.property;
            if (isPatchable(this[prop])) {
                if (patch[prop]) {
                    instance[prop] = this[prop].patch(patch[prop]);
                }
            } else {
                if (Array.isArray(this[prop])) {
                    instance[prop] = patch[prop].applyTo(this[prop]);
                } else {
                    instance[prop] = patch[prop] ?? this[prop];
                }
            }
        }
        return instance;
    }

    static sortFields() {
        function compare(a: Field, b: Field) {
            if (a.version < b.version) {
                return -1;
            }
            if (a.version > b.version) {
                return 1;
            }
            // a must be equal to b
            return 0;
        }
        this.fields.sort(compare);
    }

    static doesPropertyExist(property: string): boolean {
        for (const field of this.fields) {
            if (field.property === property) {
                return true;
            }
        }
        return false;
    }

    /**
     * Create a new one by providing the properties of the object
     */
    static create<T extends typeof AutoEncoder>(this: T, object: PartialWithoutMethods<InstanceType<T>>): InstanceType<T> {
        const model = new this() as InstanceType<T>;
        for (const key in object) {
            if (object.hasOwnProperty(key) && object[key] !== undefined && typeof object[key] !== "function") {
                // Also check this is an allowed field, else skip in favor of allowing downcasts without errors
                if (this.doesPropertyExist(key)) {
                    model[key] = object[key] as any;
                }
            }
        }
        return model;
    }

    /**
     * Create a new one by providing the properties of the object
     */
    set<T extends AutoEncoder>(this: T, object: PartialWithoutMethods<T>) {
        for (const key in object) {
            if (object.hasOwnProperty(key) && typeof object[key] !== "function") {
                if (this.static.doesPropertyExist(key)) {
                    this[key] = object[key] as any;
                }
            }
        }
    }

    get static(): typeof AutoEncoder {
        return this.constructor as typeof AutoEncoder;
    }

    encode(context: EncodeContext): PlainObject {
        const object = {};

        const appliedProperties = {};
        for (let i = this.static.fields.length - 1; i >= 0; i--) {
            const field = this.static.fields[i];
            if (field.version <= context.version && !appliedProperties[field.property]) {
                if (this[field.property] === undefined) {
                    if (!field.optional) {
                        throw new Error("Value for property " + field.property + " is not set, but is required!");
                    }
                    continue;
                }
                if (isEncodeable(this[field.property])) {
                    object[field.field] = this[field.property].encode(context);
                } else {
                    if (Array.isArray(this[field.property])) {
                        object[field.field] = this[field.property].map((e) => {
                            if (isEncodeable(e)) {
                                return e.encode(context);
                            }
                            return e;
                        });
                    } else {
                        object[field.field] = this[field.property];
                    }
                }
                appliedProperties[field.property] = true;
            }
        }

        return object;
    }

    static decode<T extends typeof AutoEncoder>(this: T, data: Data): InstanceType<T> {
        const model = new this() as InstanceType<T>;

        const appliedProperties = {};
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];

            if (field.version <= data.context.version && !appliedProperties[field.property]) {
                if (field.optional) {
                    model[field.property] = data.optionalField(field.field)?.decode(field.decoder);
                } else {
                    model[field.property] = data.field(field.field)?.decode(field.decoder);
                }

                appliedProperties[field.property] = true;
            }
        }

        return model;
    }
}
