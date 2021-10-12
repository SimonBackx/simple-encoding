import { SimpleError } from "@simonbackx/simple-errors";

import { AutoEncoder } from "../classes/AutoEncoder";
import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";
import { PatchableArray, PatchableArrayDecoder } from "./PatchableArray";
import StringOrNumberDecoder from "./StringOrNumberDecoder";

export class ArrayDecoder<T> implements Decoder<T[]> {
    decoder: Decoder<T>;

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    decode(data: Data): T[] {
        if (Array.isArray(data.value)) {
            return data.value
                .map((v, index) => {
                    return data.clone({ 
                        data: v, 
                        context: data.context, 
                        field: data.addToCurrentField(index) 
                    }).decode(this.decoder)
                })
        }

        throw new SimpleError({
            code: "invalid_field",
            message: `Expected an array at ${data.currentField}`,
            field: data.currentField,
        });
    }

    patchType() {
        const elementDecoder = this.decoder;
        if ((elementDecoder as any).patchType) {
            const patchDecoder = (elementDecoder as any).patchType();

            // Check if we have a method called "getIdentifier"
            let idFieldType: Decoder<string | number> | undefined;

            if ((elementDecoder as any).patchIdentifier) {
                // Custom identifier (in case no automatic detection is possible)
                idFieldType = (elementDecoder as any).patchIdentifier()
            } else {
                if (patchDecoder.prototype.getIdentifier) {
                    // This autoencoder uses the getIdentifier method to define the id
                    idFieldType = StringOrNumberDecoder;
                } else {
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    const field = (elementDecoder as typeof AutoEncoder).fields.find((field) => field.property == "id")
                    if (field) {
                        idFieldType = field.decoder;
                    }
                }
            }

            if (idFieldType) {
                return new PatchableArrayDecoder<any, any, any>(elementDecoder as any, patchDecoder, idFieldType as any);
            } else {
                // A non identifiable array -> we expect an optional array instead = default behaviour
                // upgrade / downgrade kan stay the same as default
                
                // We expect a normal array, of same type
                return this
            }
        }
        // Upgrade / downgrades cannot work when pathcing, should be placed on instances
        //field.upgrade = this.upgradePatch
        //field.downgrade = this.downgradePatch

        return new PatchableArrayDecoder<any, any, any>(elementDecoder as any, elementDecoder as any, elementDecoder as any);
    }

    /**
     * Patchable values of an array always create a default empty patchable array for convenience
     */
    patchDefaultValue() {
        return new PatchableArray<any, any, any>()
    }
}
