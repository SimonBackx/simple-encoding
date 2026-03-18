import { SimpleError } from '@simonbackx/simple-errors';
import { deepSet } from '../helpers/deepSet.js';
import { isAutoEncoder } from '../helpers/isAutoEncoder.js';
import { PatchableArray } from '../structs/PatchableArray.js';
import { Cloneable, cloneObject } from './Cloneable.js';
import { Data } from './Data.js';
import { Decoder } from './Decoder.js';
import { Encodeable, encodeObject, PlainObject, sortObjectKeysForEncoding } from './Encodeable.js';
import { EncodeContext, EncodeMedium } from './EncodeContext.js';
import { Field } from './Field.js';
import { hasId } from './Identifiable.js';
import { addPropertyField, ObjectData } from './ObjectData.js';
import { AutoEncoderPatchType, PartialWithoutMethods, Patchable, patchObject } from './Patchable.js';

export type PatchableDecoder<T> = Decoder<T> & (
        T extends AutoEncoder ? {} :
                (
                    T extends Patchable<infer P> ?
                            {
                                patchType: () => PatchableDecoder<P>;
                                patchIdentifier: () => Decoder<string | number>; // when patchType is a custom decoder, we also need the decoder for the identifier
                            } : {}
                )
);

export function coalesceUndefined<T>(...values: (T)[]): T | undefined {
    // Return first non-undefined value
    for (const value of values) {
        if (value !== undefined) {
            return value;
        }
    }
    return undefined;
}

type AutoEncoderConstructorNames<T> = { [K in keyof T]: T[K] extends Function | PatchableArray<any, any, any> ? never : K }[Exclude<keyof T, 'latestVersion'>];
export type AutoEncoderConstructor<T> = Pick<T, AutoEncoderConstructorNames<T>>;

/**
 * Create patchable auto encoder.
 * We are not able to add types here, gets too complex. But we'll add a convenience method with typings
 */
/* export function createPatchableAutoEncoder(constructor: typeof AutoEncoder): typeof AutoEncoder {
    return constructor as any;
} */
/*
class Dog extends AutoEncoder {
    id: string;
    name: string;
}

const DogPatch = createPatchableAutoEncoder(Dog);

const p = DogPatch.create({id: "test"})

*/

export class AutoEncoder implements Encodeable, Cloneable {
    readonly _isAutoEncoder = true;

    /// Fields should get sorted by version. Low to high
    static fields: Field<any>[] = [];
    private static cachedPatchType?: typeof AutoEncoder;

    static isPatch = false;
    static putType?: typeof AutoEncoder;
    static skipDefaultValuesVersion = 0;

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
        for (const field of (this.fields ?? [])) {
            CreatedPatch.fields.push(field.getOptionalClone());
        }

        CreatedPatch.isPatch = true;
        CreatedPatch.putType = this;

        return CreatedPatch as any;
    }

    /**
     * Try to build a default value for this object, if possible. If this is not possible it will return undefined.
     *
     * Override if you want to set custom default values or disable this behavior.
     */
    static getDefaultValue<T extends typeof AutoEncoder>(this: T): InstanceType<T> | undefined {
        try {
            const def = this.create({});
            if (hasId(def)) {
                // identifiable objects can never have a default valeu
                return undefined;
            }
            return def;
        }
        catch (e) {
            return undefined;
        }
    }

    static isDefaultValue<T extends typeof AutoEncoder>(this: T, value: AutoEncoder): boolean {
        try {
            const def = this.create({});
            if (hasId(def)) {
                return false;
            }
            return def.equals(value);
        }
        catch (e) {
            return false;
        }
    }

    equals(other: AutoEncoder): boolean {
        if (other.static !== this.static) {
            return false;
        }
        for (const field of this.static.latestFields) {
            const tValue = this[field.property];
            const oValue = other[field.property];

            if (isAutoEncoder(tValue)) {
                if (!isAutoEncoder(oValue)) {
                    return false;
                }
                if (!tValue.equals(oValue)) {
                    return false;
                }
            }
            else if (oValue !== tValue) {
                if (Array.isArray(oValue) && Array.isArray(tValue)) {
                    if (oValue.length === 0 && tValue.length === 0) {
                        // Equal
                        continue;
                    }
                }

                if (oValue instanceof Map && tValue instanceof Map) {
                    if (oValue.size === 0 && tValue.size === 0) {
                        // Equal
                        continue;
                    }
                }
                return false;
            }
        }
        return true;
    }

    isPatch<T extends AutoEncoder>(this: T | AutoEncoderPatchType<T>): this is AutoEncoderPatchType<T> {
        return this.static.isPatch;
    }

    isPut<T extends AutoEncoder>(this: T | AutoEncoderPatchType<T>): this is T {
        return !this.static.isPatch;
    }

    static patch<T extends typeof AutoEncoder>(this: T, object: PartialWithoutMethods<AutoEncoderPatchType<InstanceType<T>>>): AutoEncoderPatchType<InstanceType<T>> {
        return this.patchType().create(object);
    }

    patchOrPut<T extends AutoEncoder>(this: T, patch: AutoEncoderPatchType<T> | T) {
        if (patch.static.isPatch) {
            this.set(this.patch(patch));
            return;
        }
        this.set(patch as T);
    }

    /**
     * Make a deep clone of this object
     */
    clone<T extends AutoEncoder>(this: T): this {
        const instance = new this.static() as this;
        for (const field of this.static.latestFields) {
            const prop = field.property;
            instance[prop] = cloneObject(this[prop]);
        }

        return instance;
    }

    patch<T extends AutoEncoder>(this: T, patch: PartialWithoutMethods<AutoEncoderPatchType<T>> | AutoEncoderPatchType<T> | T | PartialWithoutMethods<T>): this {
        const instance = new this.static() as this;
        for (const field of this.static.latestFields) {
            const prop = field.property;

            instance[prop] = patchObject(
                this[prop],
                patch[prop], {
                    getDefaultValue: () => {
                        if (field.defaultValue) {
                            return field.defaultValue();
                        }

                        if (instance[prop] !== undefined && instance[prop] !== null) {
                            return instance[prop];
                        }

                        // if (field.nullable && !field.optional && !this.isPatch) {
                        //     return null;
                        // }

                        if (field.decoder && field.decoder.getDefaultValue) {
                            return field.decoder.getDefaultValue();
                        }

                        return;
                    },
                    allowAutoDefaultValue: false,
                },
            );
        }

        return instance;
    }

    private static compareField(a: Field<any>, b: Field<any>) {
        if (a.version < b.version) {
            return -1;
        }
        if (a.version > b.version) {
            return 1;
        }

        return 0;
    }

    static sortFields() {
        this.fields.sort(AutoEncoder.compareField);
    }

    /**
     * WeakMap is overkill on static classes.
     * This is drammatically faster than using Object.prototype.hasOwnProperty
     */
    static __fieldsForVersion: Map<number, Field<any>[]>;
    static __latestVersion: number;
    static __latestFields: Field<any>[];
    static __constructorDefaults: Map<string, unknown>;
    protected static getConstructorDefaults() {
        const c = this.__constructorDefaults;
        if (c !== undefined) {
            return c;
        }

        // Defined by a parent class, we need to reset it
        const cc = new this();
        const attrs = new Map<string, unknown>();

        for (const key in cc) {
            attrs.set(key, cc[key]);
        }

        // Prevent changing default values
        this.__constructorDefaults = attrs;

        return attrs;
    }

    protected static getConstructorDefault(property: string, clone = true) {
        const cc = this.getConstructorDefaults();
        const b = cc.get(property);
        if (!b) {
            return b;
        }
        if (clone && typeof b === 'object') {
            if (b instanceof Map) {
                // Does not behave correctly
                return new (b.constructor as any)(b);
            }
            return structuredClone(b);
        }
        return b;
    }

    static get latestVersion(): number {
        const c = this.__latestVersion;
        if (c !== undefined) {
            return c;
        }
        return this.setCachedLatestVersion();
    }

    static setCachedLatestVersion(): number {
        let maxVersion: number | null = null;

        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];
            if (maxVersion === null || field.version > maxVersion) {
                maxVersion = field.version;
            }
        }
        const cc = maxVersion ?? 0;

        this.__latestVersion = cc;

        return cc;
    }

    static get latestFields(): Field<any>[] {
        const c = this.__latestFields;
        if (c !== undefined) {
            return c;
        }

        const latestFields: Record<string, Field<any>> = {};
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];
            if (!latestFields[field.property]) {
                latestFields[field.property] = field;
            }
        }
        const fields = Object.values(latestFields);

        // Sort fields for stable encodings
        fields.sort((a, b) => sortObjectKeysForEncoding(a.property, b.property));

        this.__latestFields = fields;

        return fields;
    }

    static fieldsForVersion(version: number): Field<any>[] {
        const latestVersion = this.latestVersion;
        if (version > latestVersion) {
            version = latestVersion;
        }
        if (version < 0) {
            version = 0;
        }

        if (version === latestVersion) {
            return this.latestFields;
        }

        let cc = this.__fieldsForVersion;
        if (cc !== undefined) {
            const g = cc.get(version);
            if (g !== undefined) {
                return g;
            }
        }
        else {
            cc = new Map();
            this.__fieldsForVersion = cc;
        }

        const latestFields: Record<string, Field<any>> = {};
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];
            if (field.version <= version && !latestFields[field.property]) {
                latestFields[field.property] = field;
            }
        }

        const fields = Object.values(latestFields);

        // Sort fields for stable encodings
        fields.sort((a, b) => sortObjectKeysForEncoding(a.property, b.property));

        cc.set(version, fields);
        return fields;
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
            if (object[key] !== undefined && typeof object[key] !== 'function') {
                // Also check this is an allowed field, else skip in favor of allowing downcasts without errors
                if (this.doesPropertyExist(key)) {
                    model[key] = object[key] as any;
                }
            }
        }

        for (const field of this.latestFields) {
            // Use default value in every situation if set (more priority than the constructor default values)
            if (object[field.property] === undefined && field.defaultValue) { // object is required instead of model because defaultvalue has priority over constructor defaults
                model[field.property] = field.defaultValue();
            }
            else if (!field.optional) {
                if (model[field.property] === undefined) {
                    if (!this.isPatch) {
                        if (field.nullable) {
                            model[field.property] = null;
                        }
                        else if (field.decoder.getDefaultValue) {
                            model[field.property] = field.decoder.getDefaultValue();
                        }
                    }
                }
            }
            else {
                if (model[field.property] === undefined) {
                    // Explicitly set to undefined
                    model[field.property] = undefined;
                }
            }

            if (!field.optional) {
                if (model[field.property] === undefined) {
                    throw new Error('Expected required property ' + field.property + ' when creating ' + this.name);
                }
            }

            if (!field.nullable) {
                if (model[field.property] === null) {
                    throw new Error('Expected non null property ' + field.property + ' when creating ' + this.name);
                }
            }
        }
        return model;
    }

    /**
     * Create a new one by providing the properties of the object
     */
    set<T extends AutoEncoder>(this: T, object: PartialWithoutMethods<T> | T) {
        for (const key in object) {
            if (typeof object[key] !== 'function') {
                if (this.static.doesPropertyExist(key)) {
                    this[key] = object[key] as any;
                }
            }
        }
    }

    /**
     * Create a new one by providing the properties of the object.
     * Maintaining references to objects
     */
    deepSet<T extends AutoEncoder>(this: T, object: PartialWithoutMethods<T> | T) {
        return deepSet(this, object);
    }

    get static(): typeof AutoEncoder {
        return this.constructor as typeof AutoEncoder;
    }

    /**
     * When returning true, the value won't be encoded in the encoded version of the object
     */
    static isPropertyDefaultValue(field: Field<unknown>, value: unknown, longTermStorage: boolean) {
        if (field.property === 'id') {
            // optimization only
            return false;
        }

        if (longTermStorage && field.queryable) {
            // Always encode default values that need to be queried in the database
            return false;
        }

        // field.defaultValue > constructor defaults > ifNullable(null) > ifNotOptional(field.decoder.isDefaultValue) > undefined

        // 1st priority: field.defaultValue
        if (field.defaultValue) {
            if (field.isDefaultValue) {
                return field.isDefaultValue(value);
            }

            // Heuristic:
            // defining a field.defaultValue means this is an expensive operation, so there won't be a default value
            return false;
        }

        // 2nd priority: constructor defaults
        // todo: only if version okay!
        const classDefinitionDefaultValue = this.getConstructorDefault(field.property, false);
        if (classDefinitionDefaultValue !== undefined) {
            if (typeof classDefinitionDefaultValue === 'object' && classDefinitionDefaultValue !== null) {
                if (typeof value !== 'object' || value === null) {
                    return false;
                }

                // Special handling
                if ((classDefinitionDefaultValue as any).length !== undefined) {
                    // Array handling
                    return (classDefinitionDefaultValue as any).length === 0 && (value as any).length === 0;
                }

                if ((classDefinitionDefaultValue as any).size !== undefined) {
                    // Map handling
                    return (classDefinitionDefaultValue as any).size === 0 && (value as any).size === 0;
                }

                if (isAutoEncoder(value) && isAutoEncoder(classDefinitionDefaultValue)) {
                    return value.equals(classDefinitionDefaultValue);
                }

                return false;
            }

            // We have a default value defined in the class definition.
            return value === classDefinitionDefaultValue;
        }

        if (!field.optional) {
            // 3rd priority: nullable
            if (field.nullable) {
                return value === null;
            }

            // 4th priority: field.decoder.defaultValue
            if (field.decoder && field.decoder.getDefaultValue) {
                if (field.decoder.isDefaultValue) {
                    return field.decoder.isDefaultValue(value);
                }
                return false;
            }
        }
        else {
            // Default value is undefined
            return value === undefined;
        }

        return false;
    }

    encode(context: EncodeContext): PlainObject {
        const object = (this.static.isPatch ? { _isPatch: true } : {});
        const latestVersion = this.static.latestVersion;
        const version = context.version;
        let source: object;
        let fields: Field<any>[];
        if (version >= latestVersion) {
            source = this;
            fields = this.static.latestFields;
        }
        else {
            source = this.static.downgrade(version, this);
            fields = this.static.fieldsForVersion(version);
        }

        const skip = version >= AutoEncoder.skipDefaultValuesVersion || this.static.isPatch;
        const longTermStorage = context.medium === EncodeMedium.Database;

        for (const field of fields) {
            if (source[field.property] === undefined) {
                // if (!field.optional) {
                //    throw new Error('Value for property ' + field.property + ' is not set, but is required!');
                // }
                continue;
            }

            if (skip) {
                if (this.static.isPropertyDefaultValue(
                    field,
                    source[field.property],
                    longTermStorage,
                )) {
                    continue;
                }
            }

            if (field.decoder && field.decoder.encode) {
                object[field.field] = field.decoder.encode(source[field.property], context);
            }
            else {
                object[field.field] = encodeObject(source[field.property], context);
            }
        }

        return object;
    }

    static decodeField<T extends typeof AutoEncoder>(this: T, v: unknown, context: EncodeContext, currentField?: string): InstanceType<T> {
        const model = new this() as InstanceType<T>; // Object.create(this.prototype as object) as InstanceType<T>;
        const latestVersion = this.latestVersion;
        const version = context.version;
        const fields = version >= latestVersion
            ? this.latestFields
            : this.fieldsForVersion(version);

        if (!v || typeof v !== 'object') {
            throw new SimpleError({
                code: 'invalid_field',
                message: `Expected an object at ${currentField}`,
                field: currentField,
            });
        }

        // Loop from newest version to older version
        for (const field of fields) {
            let didDecode = false;

            const vv = v[field.field];

            if (vv === undefined) {
                // this should carefully match isPropertyDefaultValue
                // (field.defaultValue > constructor defaults > ifNullable(null) > ifNotOptional(field.decoder.isDefaultValue) > undefined)
                // isPropertyDefaultValue should never return true when this method does not set the same default value!
                // it is fine if isPropertyDefaultValue returns false and this method does set a default value

                if (field.defaultValue) {
                    didDecode = true;
                    model[field.property] = field.defaultValue();
                }
                else {
                    // constructor default
                    if (model[field.property] !== undefined) {
                        // keep as is
                        didDecode = true;
                    }
                    else if (!field.optional) {
                        if (field.nullable) {
                            didDecode = true;
                            model[field.property] = null;
                        }
                        else if (field.decoder && field.decoder.getDefaultValue) {
                            didDecode = true;
                            model[field.property] = field.decoder.getDefaultValue();
                        }
                    }
                    else {
                        didDecode = true;
                        model[field.property] = undefined;
                    }
                }
            }

            if (!didDecode) {
                // Decode as normal
                if (field.nullable && vv === null) {
                    model[field.property] = null;
                }
                else {
                    if (field.decoder.decodeField) {
                        model[field.property] = field.decoder.decodeField(vv, context, addPropertyField(currentField, field.field));
                    }
                    else {
                        model[field.property] = new ObjectData(vv, context, addPropertyField(currentField, field.field)).decode(field.decoder);
                    }
                }
            }
        }

        // We now have model with values equal to version data.context.version

        // Run upgrade / downgrade migrations to convert changes in fields
        if (version < latestVersion) {
            // When you set constructor defaults for fields that only exist in a new version
            // those fields will already be set, which we don't want during the upgrade.
            for (const field of this.latestFields) {
                const prop = field.property;
                if (model[prop] === undefined) {
                    continue;
                }
                let found = false;
                for (const field of fields) {
                    if (field.property === prop) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    model[prop as string] = undefined;
                }
            }
            this.upgrade(version, model);
        }

        return model;
    }

    static decode<T extends typeof AutoEncoder>(this: T, data: Data): InstanceType<T> {
        return this.decodeField(data.value, data.context, data.currentField);
    }

    /**
     * Upgrade property values coming from an older version
     * @param from
     * @param object
     */
    static upgrade<T extends typeof AutoEncoder>(from: number, object: InstanceType<T>) {
        // Run from old to new
        for (const field of this.fields) {
            if (field.version > from) {
                if (field.upgrade) {
                    object[field.property] = field.upgrade.call(object, object[field.property]);
                }
                else {
                    // Set to default
                    if (object[field.property] === undefined) {
                        if (field.defaultValue) {
                            object[field.property] = field.defaultValue();
                        }
                        else {
                            // Set default version
                            const classDefinitionDefaultValue = this.getConstructorDefault(field.property);
                            if (classDefinitionDefaultValue !== undefined) {
                                object[field.property] = classDefinitionDefaultValue;
                            }
                            else if (field.nullable && !field.optional && !this.isPatch) {
                                object[field.property] = null;
                            }
                            else if (!field.optional && field.decoder && field.decoder.getDefaultValue) {
                                object[field.property] = field.decoder.getDefaultValue();
                            }
                            else {
                                // Keep undefined
                                object[field.property] = undefined;
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Downgrade property values to a new object
     */
    static downgrade(to: number, object: any): object {
        if (to >= this.latestVersion) {
            // No downgrades
            return object;
        }

        let didCopy = false;
        let older: undefined | any;

        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];
            if (field.version > to) {
                if (field.downgrade) {
                    if (!didCopy) {
                        didCopy = true;
                        older = Object.assign({}, object);
                    }
                    older[field.property] = field.downgrade.call(object, older[field.property]);
                }
            }
        }
        if (!didCopy) {
            return object;
        }
        return older;
    }
}
