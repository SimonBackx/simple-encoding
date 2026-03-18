import { SimpleError } from '@simonbackx/simple-errors';
import { PatchableDecoder } from '../classes/AutoEncoder.js';
import { Field } from '../classes/Field.js';

export function field<T>(settings: {
    optional?: boolean;
    nullable?: boolean;
    queryable?: boolean;
    decoder: PatchableDecoder<T>;
    defaultValue?: () => any;
    isDefaultValue?: (value: unknown) => boolean;
    patchDefaultValue?: () => any;

    upgrade?: (old: any) => any;
    downgrade?: (newer: any) => any;

    upgradePatch?: (old: any) => any;
    downgradePatch?: (newer: any) => any;

    /**
     * Version in which this field was added
     */
    version?: number;

    /**
     * Name in the encoded version
     */
    field?: string;
}) {
    return (target: any /* future typeof Model */, key: string) => {
        if (!target.constructor.fields || !Object.hasOwn(target.constructor as object, 'fields')) {
            target.constructor.fields = target.constructor.fields?.slice(0) ?? [];
            target.constructor.fields.createdFor = target.constructor;

            target.constructor.cachedPatchType = undefined;

            // Reset caches
            // Override parent definitions
            target.constructor.__latestVersion = undefined;
            target.constructor.__latestFields = undefined;
            target.constructor.__fieldsForVersion = new Map();
            target.constructor.__cachedInstance = undefined;
        }

        const field = new Field<T>();
        field.optional = settings.optional ?? false;
        field.nullable = settings.nullable ?? false;
        field.queryable = settings.queryable ?? false;
        field.decoder = settings.decoder;
        field.version = settings.version ?? 0;
        field.field = settings.field ?? key;
        field.upgrade = settings.upgrade;
        field.downgrade = settings.downgrade;
        field.upgradePatch = settings.upgradePatch;
        field.downgradePatch = settings.downgradePatch;
        field.defaultValue = settings.defaultValue;
        field.isDefaultValue = settings.isDefaultValue;
        field.patchDefaultValue = settings.patchDefaultValue;
        field.property = key;

        target.constructor.fields.push(field);
        // target.constructor.latestVersion = Math.max(target.constructor.latestVersion ?? 0, settings.version ?? 0);
        target.constructor.sortFields();

        const allFields = (target.constructor.fields as unknown as Field<unknown>[]).filter(f => f.property === key);

        const propertyLatestVersion = Math.max(0, ...allFields.map(f => f.version));

        for (const f of allFields) {
            f.hasNewerField = (f.version) < propertyLatestVersion;
        }

        // Security check
        if (allFields.find(f => f !== field && !!f.defaultValue !== !!field.defaultValue)) {
            throw new SimpleError({
                code: 'missing_default_value',
                message: 'When you define defaultValue for at least one version of a property, you need to set if for each version. For property: ' + field.property,
                field: field.property,
            });
        }
    };
}
