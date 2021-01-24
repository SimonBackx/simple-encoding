import { SimpleError } from "@simonbackx/simple-errors";

import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";

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
}
