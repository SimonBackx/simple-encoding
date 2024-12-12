import { SimpleError } from "@simonbackx/simple-errors";

import { Data } from "../classes/Data.js";
import { Decoder } from "../classes/Decoder.js";

class StringDecoder implements Decoder<string> {
    decode(data: Data): string {
        if (typeof data.value == "string") {
            return data.value;
        }
        throw new SimpleError({
            code: "invalid_field",
            message: `Expected a string at ${data.currentField}`,
            field: data.currentField
        });
    }

    isDefaultValue(value: unknown): boolean {
        return value === "";
    }

    getDefaultValue(): string {
        return "";
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new StringDecoder();
