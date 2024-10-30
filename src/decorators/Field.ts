import { AutoEncoder, Field, PatchableDecoder } from "../classes/AutoEncoder.js";
import { Decoder } from "../classes/Decoder.js";

export function field<T>(settings: {
    optional?: boolean;
    nullable?: boolean;
    decoder: PatchableDecoder<T>;
    defaultValue?: () => any;
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
        if (!target.constructor.fields) {
            target.constructor.fields = [];
            target.constructor.fields.createdFor = target.constructor;
        } else {
            if (target.constructor.fields.createdFor && target.constructor.fields.createdFor !== target.constructor) {
                // need to clone instead of creating a new reference
                target.constructor.fields = target.constructor.fields.slice(0);
                target.constructor.fields.createdFor = target.constructor;
                target.constructor.cachedPatchType = undefined;
            }
        }

        const field = new Field<T>();
        field.optional = settings.optional ?? false;
        field.nullable = settings.nullable ?? false;
        field.decoder = settings.decoder;
        field.version = settings.version ?? 0;
        field.field = settings.field ?? key;
        field.upgrade = settings.upgrade;
        field.downgrade = settings.downgrade;
        field.upgradePatch = settings.upgradePatch;
        field.downgradePatch = settings.downgradePatch;
        field.defaultValue = settings.defaultValue;
        field.patchDefaultValue = settings.patchDefaultValue;
        field.property = key;

        target.constructor.fields.push(field);
        target.constructor.latestVersion = Math.max(target.constructor.latestVersion ?? 0, settings.version ?? 0);
        target.constructor.sortFields();
    };
}
