import { AutoEncoder, Field } from "../classes/AutoEncoder";
import { Decoder } from "../classes/Decoder";

export function field<Key extends keyof any, Value extends AutoEncoder>(settings: {
    optional?: boolean;
    nullable?: boolean;
    decoder: Decoder<any>;
    defaultValue?: () => any;

    upgrade?: (old: any) => any;
    downgrade?: (newer: any) => any;

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
            }
        }

        const field = new Field();
        field.optional = settings.optional ?? false;
        field.nullable = settings.nullable ?? false;
        field.decoder = settings.decoder;
        field.version = settings.version ?? 0;
        field.field = settings.field ?? key;
        field.upgrade = settings.upgrade;
        field.downgrade = settings.downgrade;
        field.defaultValue = settings.defaultValue;
        field.property = key;

        target.constructor.fields.push(field);
        target.constructor.latestVersion = Math.max(target.constructor.latestVersion ?? 0, settings.version ?? 0);
        target.constructor.sortFields();
    };
}
