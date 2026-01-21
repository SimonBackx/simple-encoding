import { SimpleError } from '@simonbackx/simple-errors';
import { PatchableArray, PatchableArrayDecoder } from '../structs/PatchableArray.js';
import { Cloneable, cloneObject } from './Cloneable.js';
import { Data } from './Data.js';
import { Decoder } from './Decoder.js';
import { Encodeable, encodeObject, PlainObject, sortObjectKeysForEncoding } from './Encodeable.js';
import { EncodeContext } from './EncodeContext.js';
import { getId, getOptionalId, hasId } from './Identifiable.js';
import { AutoEncoderPatchType, isPatchable, isPatchableArray, isPatchMap, PartialWithoutMethods, Patchable, PatchMap, patchObject } from './Patchable.js';

// export type PatchableDecoder<T> = Decoder<T> & (T extends Patchable<infer P> ? { patchType: () => PatchableDecoder<P> }: {})
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
/**
 * Uses the meta data of AutoEncoder to check if something is a patch or a put
 */
export class PatchOrPutDecoder<Put extends Patchable<Patch>, Patch> implements Decoder<Patch | Put> {
    putDecoder: Decoder<Put>;
    patchDecoder: Decoder<Patch>;

    constructor(put: Decoder<Put>, patch: Decoder<Patch>) {
        this.putDecoder = put;
        this.patchDecoder = patch;
    }

    decode(data: Data): Put | Patch {
        const isPatch = data.optionalField('_isPatch');
        if (isPatch?.boolean ?? false) {
            return this.patchDecoder.decode(data);
        }

        return this.putDecoder.decode(data);
    }

    getDefaultValue(): Patch | Put | undefined {
        return this.patchDecoder.getDefaultValue ? this.patchDecoder.getDefaultValue() : (undefined as any);
    }
}

export function deepSetArray(oldArr: any[], newArray: any[], options?: { keepMissing?: boolean }) {
    if (oldArr === newArray) {
        // Same reference: nothing to do
        return;
    }

    const oldArray = (oldArr as any[]).slice();

    // Loop old array
    // Keep array reference
    // Delete deleted items
    // Add new items
    // Copy over changes from updated items
    // Maintain new order

    // Clear out old array
    oldArr.splice(0, oldArr.length);

    for (const newItem of newArray) {
        if (isAutoEncoder(newItem)) {
            const oldItem = oldArray.find(i => getOptionalId(i) === getOptionalId(newItem));
            if (oldItem && isAutoEncoder(oldItem)) {
                oldItem.deepSet(newItem);
                oldArr.push(oldItem);
            }
            else {
                oldArr.push(newItem);
            }
        }
        else {
            oldArr.push(newItem);
        }
    }

    if (options?.keepMissing) {
        // Readd old missing items
        for (const oldItem of oldArray) {
            const found = oldArr.find(i => getOptionalId(i) === getOptionalId(oldItem));

            if (!found) {
                oldArr.push(oldItem);
            }
        }
    }
}

export function coalesceUndefined<T>(...values: (T)[]): T | undefined {
    // Return first non-undefined value
    for (const value of values) {
        if (value !== undefined) {
            return value;
        }
    }
    return undefined;
}

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

    /**
     * Internal value for unsupported versions
     */
    patchDefaultValue?: () => any;

    getOptionalClone() {
        const field = new Field();
        field.optional = true;
        field.nullable = this.nullable;
        field.decoder = this.decoder;
        field.version = this.version;
        field.property = this.property;
        field.field = this.field;

        if (this.upgrade) {
            const upg = this.upgrade;
            field.upgrade = (oldValue) => {
                if (oldValue !== undefined) {
                    // Value is set, we need an upgrade
                    return upg(oldValue);
                }
                else {
                    // No value is set, we don't need an upgrade
                    return undefined;
                }
            };
        }

        if (this.downgrade) {
            const dwn = this.downgrade;
            field.downgrade = (newValue) => {
                if (newValue !== undefined) {
                    // Value is set, we need an upgrade
                    return dwn(newValue);
                }
                else {
                    // No value is set, we don't need an upgrade
                    return undefined;
                }
            };
        }

        if (this.upgradePatch) {
            field.upgrade = this.upgradePatch;
        }

        if (this.downgradePatch) {
            field.downgrade = this.downgradePatch;
        }

        field.upgradePatch = this.upgradePatch;
        field.downgradePatch = this.downgradePatch;
        field.patchDefaultValue = this.patchDefaultValue;

        field.defaultValue = undefined; // do not copy default values. Patches never have default values, unless for patchable arrays

        const aDecoder = this.decoder as any;

        // Do we have a custom patch decoder? (this can be configured in the decoder)
        if (aDecoder.patchType) {
            field.upgrade = this.upgradePatch;
            field.downgrade = this.downgradePatch;
            const patchDecoder = aDecoder.patchType();
            field.decoder = new PatchOrPutDecoder(aDecoder, patchDecoder);
        }

        if (aDecoder.patchDefaultValue) {
            // e.g. for patchable arrays we always set a default value
            field.defaultValue = () => {
                return aDecoder.patchDefaultValue();
            };
        }

        if (this.patchDefaultValue) {
            field.defaultValue = this.patchDefaultValue;
        }

        return field;
    }
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

export function isAutoEncoder(obj: unknown): obj is AutoEncoder {
    return obj instanceof AutoEncoder || (typeof obj === 'object' && obj !== null && (obj as any)._isAutoEncoder);
}

export class AutoEncoder implements Encodeable, Cloneable {
    _isAutoEncoder = true;

    /// Fields should get sorted by version. Low to high
    static fields: Field<any>[];
    private static cachedPatchType?: typeof AutoEncoder;

    static isPatch = false;
    static putType?: typeof AutoEncoder;
    static skipDefaultValues = false;

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

    constructor() {
        if (!this.static.fields) {
            this.static.fields = [];
        }

        for (const field of this.static.latestFields) {
            if (field.defaultValue) {
                this[field.property] = field.defaultValue();
            }
        }
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
                    defaultValue: instance[prop] === undefined || instance[prop] === null ? (field.decoder.getDefaultValue ? field.decoder.getDefaultValue() : instance[prop]) : instance[prop],
                    allowAutoDefaultValue: false,
                },
            );
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

            return 0;
        }
        this.fields.sort(compare);
    }

    static _cachedLatestFields?: { fields: Field<any>[]; totalFieldsCount: number } | null;
    static _cachedFieldsForVersion?: Map<number, Field<any>[]>;

    static get latestFields(): Field<any>[] {
        // We need to clear if we detect taht the _cachedLatestFields is defined on a superclass, but not on this class itself
        if (!Object.hasOwnProperty.call(this, '_cachedLatestFields') && this._cachedLatestFields) {
            this._cachedLatestFields = null; // Explicitly set to null to avoid confusion
        }

        if (this._cachedLatestFields && this._cachedLatestFields.totalFieldsCount === this.fields.length) {
            return this._cachedLatestFields.fields;
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

        this._cachedLatestFields = { fields, totalFieldsCount: this.fields.length };
        return fields;
    }

    static fieldsForVersion(version: number): Field<any>[] {
        // We need to clear if we detect taht the _cachedLatestFields is defined on a superclass, but not on this class itself
        if (!Object.hasOwnProperty.call(this, '_cachedFieldsForVersion') && this._cachedFieldsForVersion) {
            this._cachedFieldsForVersion = new Map();
        }

        if (!this._cachedFieldsForVersion) {
            this._cachedFieldsForVersion = new Map();
        }

        if (this._cachedFieldsForVersion.has(version)) {
            return this._cachedFieldsForVersion.get(version)!;
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

        this._cachedFieldsForVersion.set(version, fields);
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
            // eslint-disable-next-line no-prototype-builtins
            if (object.hasOwnProperty(key) && object[key] !== undefined && typeof object[key] !== 'function') {
                // Also check this is an allowed field, else skip in favor of allowing downcasts without errors
                if (this.doesPropertyExist(key)) {
                    model[key] = object[key] as any;
                }
            }
        }

        for (const field of this.latestFields) {
            if (!field.optional) {
                if (model[field.property] === undefined) {
                    if (!this.isPatch) {
                        if (field.nullable) {
                            model[field.property] = null;
                        }
                        else if (field.decoder.getDefaultValue) {
                            model[field.property] = field.decoder.getDefaultValue();
                        }
                    }

                    if (model[field.property] === undefined) {
                        throw new Error('Expected required property ' + field.property + ' when creating ' + this.name);
                    }
                }
            }
            else {
                if (model[field.property] === undefined) {
                    // Explicitly set to undefined
                    model[field.property] = undefined;
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
            if (object.hasOwnProperty(key) && typeof object[key] !== 'function') {
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
        if (object === this) {
            // Nothing to do (waste of resources)
            return;
        }

        for (const key in object) {
            if (object.hasOwnProperty(key) && typeof object[key] !== 'function') {
                if (this.static.doesPropertyExist(key)) {
                    if (object[key] === undefined) {
                        // ignore
                        continue;
                    }

                    if (isAutoEncoder(this[key]) && object[key] !== null && typeof object[key] === 'object') {
                        this[key].deepSet(object[key]);
                    }
                    else if (Array.isArray(this[key]) && Array.isArray(object[key])) {
                        deepSetArray(this[key], object[key]);
                    }
                    else {
                        this[key] = object[key] as any;
                    }
                }
            }
        }
    }

    get static(): typeof AutoEncoder {
        return this.constructor as typeof AutoEncoder;
    }

    encode(context: EncodeContext): PlainObject {
        if (hasId(this) && !this.static.isPatch && (false as any)) {
            if (context.references === undefined) {
                context.references = new Map();
            }

            let classReferences = context.references.get(this.static);
            if (classReferences) {
                // Dramatically reduce size of encoding when lots of relations are returned with the same id
                const id = getId(this);
                const existing = classReferences.get(id);

                // We already returned this same object
                if (existing) {
                    // For optimizations we could skip this step, but for now we keep it
                    if (existing === this) {
                        return {
                            _ref: id,
                        };
                    }
                    else {
                        const a = existing.encode({ version: context.version });
                        const b = this.encode({ version: context.version });

                        if (JSON.stringify(a) === JSON.stringify(b)) {
                            return {
                                _ref: id,
                            };
                        }
                        console.warn('Same id, but different objects in the encode result. This should not happen and reduces the ability to use references in encoded data.', id);
                    }
                }
            }

            // Add self
            if (!classReferences) {
                classReferences = new Map();
                context.references.set(this.static, classReferences);
            }
            const idField = this.static.latestFields.find(f => f.property === 'id');
            if (idField) {
                classReferences.set(getId(this), this);
            }
        }

        const object = {};
        const source = this.static.downgrade(context.version, this);

        for (const field of this.static.fieldsForVersion(context.version)) {
            if (source[field.property] === undefined) {
                if (!field.optional) {
                    throw new Error('Value for property ' + field.property + ' is not set, but is required!');
                }
                continue;
            }

            if (this.static.isPatch) {
                // Don't send certain values to minimize data
                if (isPatchableArray(source[field.property]) && source[field.property].changes.length === 0) {
                    continue;
                }

                if (isPatchMap(source[field.property]) && source[field.property].size === 0) {
                    continue;
                }
            }

            if (AutoEncoder.skipDefaultValues && !this.static.isPatch) {
                if (field.nullable && !field.optional && source[field.property] === null) {
                    // Don't send null values - will be handled as null automatically on the receiving side
                    continue;
                }

                if (!field.nullable && field.decoder.isDefaultValue && field.decoder.isDefaultValue(source[field.property])) {
                    // Skip
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

        // Add meta data
        if (this.static.isPatch) {
            object['_isPatch'] = this.static.isPatch;
        }

        return object;
    }

    static decode<T extends typeof AutoEncoder>(this: T, data: Data): InstanceType<T> {
        const isRef = data.optionalField('_ref');
        if (isRef) {
            const idField = this.latestFields.find(f => f.property === 'id');

            if (!idField) {
                throw new SimpleError({
                    code: 'invalid_data',
                    message: 'No id field found in class ' + this.name,
                    field: data.addToCurrentField('_ref'),
                });
            }

            const stringOrNumber = isRef.decode(idField.decoder) as string | number;
            const classReferences = data.context.references?.get(this);

            if (!classReferences) {
                throw new SimpleError({
                    code: 'invalid_reference',
                    message: 'Invalid usage of references: the _ref field can only be used when the same object is encoded earlier, but no reference found for ' + stringOrNumber,
                    field: data.addToCurrentField('_ref'),
                });
            }

            const reference = classReferences.get(stringOrNumber);
            if (!reference) {
                throw new SimpleError({
                    code: 'invalid_reference',
                    message: 'Reference not found with ID ' + stringOrNumber,
                    field: data.addToCurrentField('_ref'),
                });
            }

            return reference as InstanceType<T>;
        }

        const model = new this() as InstanceType<T>;

        const appliedProperties = {};

        // Loop from newest version to older version
        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];

            if (field.version <= data.context.version && !appliedProperties[field.property]) {
                const fieldData = data.undefinedField(field.field);

                if (!fieldData && !field.optional && field.nullable) {
                    // Special case because we are not using the Nullable Decoder directly
                    model[field.property] = null;
                }
                else if (!fieldData && !field.optional && field.property !== 'id' && (model[field.property] !== undefined || field.decoder.getDefaultValue)) {
                    // Property has not been set. Set it to the default value of the decoder
                    if (field.decoder.getDefaultValue) {
                        model[field.property] = coalesceUndefined(model[field.property], field.decoder.getDefaultValue());
                    }
                    else {
                        // Already set
                    }
                }
                else if (field.optional) {
                    if (field.nullable) {
                        // Set to null if set to null, set to undefined if not received
                        model[field.property] = coalesceUndefined(fieldData?.nullable(field.decoder), model[field.property]);
                    }
                    else {
                        // When null, still set the default values
                        model[field.property] = data.optionalField(field.field)?.decode(field.decoder) ?? model[field.property] ?? undefined;
                    }

                    /* if (!fieldData) {
                        // Set to undefined or keep current default value
                        model[field.property] = coalesceUndefined(model[field.property], undefined);
                    }
                    else {
                        if (!this.isPatch) {
                            // Optional fields always have a dedicated default value set
                            if (field.nullable) {
                                // Set to null if set to null, set to undefined if not received
                                model[field.property] = coalesceUndefined(fieldData?.nullable(field.decoder), model[field.property]);
                            }
                            else {
                                // When null, still set the default values
                                model[field.property] = data.optionalField(field.field)?.decode(field.decoder) ?? model[field.property] ?? undefined;
                            }
                        }
                        else {
                            // Never use default values
                            // Do use the default value from the object itself (will be an empty patchabel array or map)
                            if (field.nullable) {
                                model[field.property] = coalesceUndefined(fieldData?.nullable(field.decoder), model[field.property]);
                            }
                            else {
                                // When null, still set the default values
                                model[field.property] = data.optionalField(field.field)?.decode(field.decoder) ?? model[field.property] ?? undefined;
                            }
                        }
                    } */
                }
                else {
                    if (field.nullable) {
                        model[field.property] = data.field(field.field).nullable(field.decoder);
                    }
                    else {
                        model[field.property] = data.field(field.field).decode(field.decoder);
                    }
                }

                appliedProperties[field.property] = true;
            }
        }

        // We now have model with values equal to version data.context.version

        // Run upgrade / downgrade migrations to convert changes in fields
        this.upgrade(data.context.version, model);

        if (!this.isPatch) {
            if (data.context.references === undefined) {
                data.context.references = new Map();
            }

            let classReferences = data.context.references.get(this);

            if (!classReferences) {
                classReferences = new Map();
                data.context.references.set(this, classReferences);
            }

            if (classReferences && hasId(model)) {
                classReferences.set(getId(model), model);
            }
        }

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
        let didCopy = false;
        const older = {};

        for (let i = this.fields.length - 1; i >= 0; i--) {
            const field = this.fields[i];
            if (field.version > to) {
                if (field.downgrade) {
                    if (!didCopy) {
                        didCopy = true;
                        Object.assign(older, object);
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
