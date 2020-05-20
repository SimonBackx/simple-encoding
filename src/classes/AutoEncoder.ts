import { Decoder } from "./Decoder";
import { Encodeable, PlainObject, isEncodeable } from "./Encodeable";
import { Data } from "./Data";
import { field } from "../decorators/Field";
import { Patchable, isPatchable } from "./Patchable";

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
    defaultValue: any;
}

type NonFunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T];
type NonFunctionProperties<T> = Pick<T, NonFunctionPropertyNames<T>>;

type Omit<T, K> = Pick<T, Exclude<keyof T, K>>;
type WithOptional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

function createPatchableAutoEncoder<T extends typeof AutoEncoder>(
    constructor: T
): InstanceType<T> extends { id: number | string }
    ? typeof AutoEncoder & { new (): Omit<Partial<InstanceType<T>>, "id"> & { id: number | string } & Encodeable }
    : never {
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
    latestVersion?: number;
    static latestVersion?: number;
    static patch<T extends typeof AutoEncoder>(this: T) {
        return createPatchableAutoEncoder(this);
    }

    constructor() {
        if (!this.static.fields) {
            this.static.fields = [];
        }
        this.latestVersion = this.static.latestVersion;
    }

    patch<T extends typeof AutoEncoder>(this: InstanceType<T>, patch: Partial<InstanceType<T>>): InstanceType<T> {
        const instance = new this.static() as InstanceType<T>;
        for (const field of this.static.fields) {
            const prop = field.property;
            if (isPatchable(this[prop])) {
                if (patch[prop]) {
                    instance[prop] = this[prop].patch(patch[prop]);
                }
            } else {
                instance[prop] = patch[prop] ?? this[prop];
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

    /**
     * Create a new one by providing the properties of the object
     */
    static create<T extends typeof AutoEncoder>(this: T, object: NonFunctionProperties<InstanceType<T>>): InstanceType<T> {
        const model = new this() as InstanceType<T>;
        for (const key in object) {
            if (object.hasOwnProperty(key)) {
                model[key] = object[key];
            }
        }
        return model;
    }

    get static(): typeof AutoEncoder {
        return this.constructor as typeof AutoEncoder;
    }

    encode(version?: number): PlainObject {
        const object = {};
        if (!version) {
            console.warn("Avoid encoding without specifying a version. This will get deprectated in the future");
            version = this.latestVersion ?? 0;
        }

        const appliedProperties = {};
        for (let i = this.static.fields.length - 1; i >= 0; i--) {
            const field = this.static.fields[i];
            if (field.version <= version && !appliedProperties[field.property]) {
                if (isEncodeable(this[field.property])) {
                    object[field.field] = this[field.property].encode(version);
                } else {
                    if (Array.isArray(this[field.property])) {
                        object[field.field] = this[field.property].map((e) => {
                            if (isEncodeable(e)) {
                                return e.encode(version);
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

        let version = data.version;
        if (!version) {
            console.warn("Avoid encoding without specifying a version. This will get deprectated in the future");
            version = this.latestVersion ?? 0;
        }

        const appliedProperties = {};
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];

            if (field.version <= version && !appliedProperties[field.property]) {
                let context;
                if (field.optional) {
                    context = data.optionalField(field.field);
                } else {
                    context = data.field(field.field);
                }
                model[field.property] = context.decode(field.decoder);

                appliedProperties[field.property] = true;
            }
        }

        return model;
    }
}
