import { SimpleError } from '@simonbackx/simple-errors';

import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';

class IntegerDecoder implements Decoder<number> {
    decode(data: Data): number {
        if (typeof data.value === 'number' && Number.isSafeInteger(data.value)) {
            return data.value;
        }

        if (typeof data.value === 'string') {
            const parsed = Number.parseInt(data.value);
            if (!isNaN(parsed)) {
                return parsed;
            }
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Expected an integer at ${data.currentField}`,
            field: data.currentField,
        });
    }
}

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new IntegerDecoder();
