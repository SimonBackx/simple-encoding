import { SimpleError } from "@simonbackx/simple-errors";

import { Data } from "../classes/Data.js";
import { Decoder } from "../classes/Decoder.js";

class BooleanDecoder implements Decoder<boolean> {
    decode(data: Data): boolean {
        if (data.value === true || data.value === false) {
            return data.value;
        }

        if (data.value === "true") {
            return true;
        }

        if (data.value === "false") {
            return false;
        }

        if (data.value === 1) {
            return true;
        }

        if (data.value === 0) {
            return false;
        }

        throw new SimpleError({
            code: "invalid_field",
            message: `Expected a boolean at ${data.currentField}`,
            field: data.currentField,
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new BooleanDecoder();
