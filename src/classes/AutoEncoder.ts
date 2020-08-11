import { ArrayDecoder } from "../structs/ArrayDecoder";
import { PatchableArray, PatchableArrayDecoder } from "../structs/PatchableArray";
import { PatchOrPut,PatchOrPutDecoder } from '../structs/PatchOrPut';
import StringDecoder from '../structs/StringDecoder';
import StringOrNumberDecoder from '../structs/StringOrNumberDecoder';
import { Data } from "./Data";
import { Decoder } from "./Decoder";
import { Encodeable, isEncodeable,PlainObject } from "./Encodeable";
import { EncodeContext } from "./EncodeContext";
import { AutoEncoderPatchType,isPatchable, PartialWithoutMethods, Patchable } from "./Patchable";

export type PatchableDecoder<T> = Decoder<T> & (T extends Patchable<infer P> ? { patchType: () => PatchableDecoder<P> }: {})

export class Field<T> {
    optional: boolean;
    nullable: boolean;
    decoder: PatchableDecoder<T>;

    /**
     * Executed after decoding / before encoding to convert to a correct internal value (= latest version)
     */
    upgrade?: (old: any) => any;
    downgrade?: (newer: any) => any;

    upgradePatch?: (old: any) => any;
    downgradePatch?: (newer: any) => any;

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
        field.nullable = this.nullable;
        field.decoder = this.decoder;
        field.version = this.version;
        field.property = this.property;
        field.field = this.field;
        if (this.upgrade) {
            const upg = this.upgrade
            field.upgrade = (oldValue) => { 
                if (oldValue !== undefined) {
                    // Value is set, we need an upgrade 
                    return upg(oldValue) 
                } else {
                    // No value is set, we don't need an upgrade
                    return undefined
                }
            };
        }
        if (this.downgrade) {
            const dwn = this.downgrade
            field.downgrade = (newValue) => { 
                if (newValue !== undefined) {
                    // Value is set, we need an upgrade 
                    return dwn(newValue) 
                } else {
                    // No value is set, we don't need an upgrade
                    return undefined
                }
            };
        }

        if (this.upgradePatch) {
            field.upgrade = this.upgradePatch
        }

        if (this.downgradePatch) {
            field.downgrade = this.downgradePatch
        }

        field.upgradePatch = this.upgradePatch
        field.downgradePatch = this.downgradePatch

        field.defaultValue = undefined; // do not copy default values. Patches never have default values!

        const aDecoder = this.decoder as any;
        if (this.decoder instanceof ArrayDecoder) {
            const elementDecoder = this.decoder.decoder;
            if ((elementDecoder as any).patchType) {
                const patchType = (elementDecoder as any).patchType();

                // Check if we have a method called "getIdentifier"
                let idFieldType: Decoder<string | number> | undefined;
                if (patchType.prototype.getIdentifier) {
                    // This autoencoder uses the getIdentifier method to define the id
                    idFieldType = StringOrNumberDecoder;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    const field = (elementDecoder as typeof AutoEncoder).fields.find((field) => field.property == "id")
                    if (field) {
                        idFieldType = field.decoder;
                    }
                }

                if (idFieldType) {
                     // Upgrade / downgrades cannot work when pathcing, should be placed on instances
                    field.upgrade = this.upgradePatch
                    field.downgrade = this.downgradePatch
                    
                    field.decoder = new PatchableArrayDecoder(elementDecoder, patchType, idFieldType);
                    field.defaultValue = () => new PatchableArray<any, any, any>();
                } else {
                    // A non identifiable array -> we expect an optional array instead = default behaviour
                    // upgrade / downgrade kan stay the same as default
                }
                
            } else {
                 // Upgrade / downgrades cannot work when pathcing, should be placed on instances
                field.upgrade = this.upgradePatch
                field.downgrade = this.downgradePatch

                field.decoder = new PatchableArrayDecoder(elementDecoder, elementDecoder, elementDecoder);
                field.defaultValue = () => new PatchableArray<any, any, any>();
            }
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        } else if (aDecoder.prototype && aDecoder.prototype instanceof AutoEncoder) {
            /*if (field.upgrade || field.downgrade) {
                console.warn("Upgrade and downgrades on patchable AutoEncoder objects are not yet supported");
            }*/
            // Upgrade / downgrade not supported yet!

            field.upgrade = this.upgradePatch
            field.downgrade = this.downgradePatch
            field.decoder = new PatchOrPutDecoder(aDecoder, aDecoder.patchType());
        } else if (aDecoder.patchType) {
            field.upgrade = this.upgradePatch
            field.downgrade = this.downgradePatch
            field.decoder = new PatchOrPutDecoder(aDecoder, aDecoder.patchType());
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
/*export function createPatchableAutoEncoder(constructor: typeof AutoEncoder): typeof AutoEncoder {
    return constructor as any;
}*/
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
    static fields: Field<any>[];
    private static cachedPatchType?: typeof AutoEncoder;

    /// Create a patch for this instance (of reuse if already created)
    static patchType<T extends typeof AutoEncoder>(this: T): typeof AutoEncoder & (new () => AutoEncoderPatchType<InstanceType<T>>) {
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

        // move over getIdentifier if available
        if ((this as any).prototype.getIdentifier && (this as any).prototype.getIdentifier instanceof Function) {
            (CreatedPatch.prototype as any).getIdentifier = (this as any).prototype.getIdentifier;
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

    patch<T extends AutoEncoder>(this: T, patch: AutoEncoderPatchType<T>): this {
        const instance = new this.static() as this;
        for (const field of this.static.fields) {
            const prop = field.property;
            if (isPatchable(this[prop])) {
                // Check if patch[prop] is a patchable array
                if (patch[prop] instanceof PatchOrPut) {
                    instance[prop] = PatchOrPut.apply(this[prop], patch[prop])
                } else {
                    if (patch[prop] !== undefined) {
                        instance[prop] = this[prop].patch(patch[prop]);
                    } else {
                        instance[prop] = this[prop];
                    }
                }
            } else {
                if (Array.isArray(this[prop])) {
                    // Check if patch[prop] is a patchable array
                    if (patch[prop] instanceof PatchableArray) {
                        instance[prop] = patch[prop].applyTo(this[prop]);
                    } else {
                        // What happens when an array field is set?
                        // This can only happen when the autocoder is not identifieable, but
                        // technically also in other cases if typescript doesn't check types
                        // we just take over the new values and 'remove' all old elements
                        instance[prop] = patch[prop];
                    }
                } else {
                    // we need to check for undefined and not use ??
                    // because we also need to set values to null
                    if (patch[prop] === undefined) {
                        instance[prop] = this[prop];
                    } else {
                        instance[prop] = patch[prop];
                    }
                }
            }
        }

        return instance;
    }

    static sortFields() {
        function compare(a: Field<any>, b: Field<any>) {
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

    static get latestFields(): Field<any>[] {
        const latestFields = {};
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];
            if (!latestFields[field.property]) {
                latestFields[field.property] = field;
            }
        }
        return Object.values(latestFields);
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
            // eslint-disable-next-line no-prototype-builtins
            if (object.hasOwnProperty(key) && object[key] !== undefined && typeof object[key] !== "function") {
                // Also check this is an allowed field, else skip in favor of allowing downcasts without errors
                if (this.doesPropertyExist(key)) {
                    model[key] = object[key] as any;
                }
            }
        }

        for (const field of this.latestFields) {
            if (!field.optional) {
                if (model[field.property] === undefined) {
                    throw new Error("Expected required property " + field.property + " when creating " + this.name);
                }
            }

            if (!field.nullable) {
                if (model[field.property] === null) {
                    throw new Error("Expected non null property " + field.property + " when creating " + this.name);
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
        const source = this.static.downgrade(context.version, this);

        const appliedProperties = {};
        for (let i = this.static.fields.length - 1; i >= 0; i--) {
            const field = this.static.fields[i];
            if (field.version <= context.version && !appliedProperties[field.property]) {
                if (source[field.property] === undefined) {
                    if (!field.optional) {
                        throw new Error("Value for property " + field.property + " is not set, but is required!");
                    }
                    continue;
                }
                if (isEncodeable(source[field.property])) {
                    object[field.field] = source[field.property].encode(context);
                } else {
                    if (Array.isArray(source[field.property])) {
                        object[field.field] = source[field.property].map((e) => {
                            if (isEncodeable(e)) {
                                return e.encode(context);
                            }
                            return e;
                        });
                    } else {
                        object[field.field] = source[field.property];
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

        // Loop from newest version to older version
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];

            if (field.version <= data.context.version && !appliedProperties[field.property]) {
                if (field.optional) {
                    if (field.nullable) {
                        model[field.property] = data.undefinedField(field.field)?.nullable(field.decoder);
                    } else {
                        model[field.property] = data.optionalField(field.field)?.decode(field.decoder) ?? model[field.property] ?? undefined;
                    }
                } else {
                    if (field.nullable) {
                        model[field.property] = data.field(field.field)?.nullable(field.decoder);
                    } else {
                        model[field.property] = data.field(field.field)?.decode(field.decoder);
                    }
                }

                appliedProperties[field.property] = true;
            }
        }

        // We now have model with values equal to version data.context.version

        // Run upgrade / downgrade migrations to convert changes in fields
        this.upgrade(data.context.version, model);

        return model;
    }

    /**
     * Upgrade property values coming from an older version
     * @param from
     * @param object
     */
    static upgrade<T extends typeof AutoEncoder>(from: number, object: InstanceType<T>) {
        for (const field of this.fields) {
            if (field.version > from) {
                if (field.upgrade) {
                    object[field.property] = field.upgrade.call(object, object[field.property]);
                }
            }
        }
    }

    /**
     * Downgrade property values to a new object
     */
    static downgrade(to: number, object: any): object {
        const older: object = Object.assign({}, object);
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];
            if (field.version > to) {
                if (field.downgrade) {
                    older[field.property] = field.downgrade.call(object, older[field.property]);
                }
            }
        }
        return older;
    }
}
