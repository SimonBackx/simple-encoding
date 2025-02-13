import { Data } from '../classes/Data.js';
import { Decoder } from '../classes/Decoder.js';
import { EncodeContext } from '../classes/EncodeContext.js';

class DateDecoder implements Decoder<Date> {
    decode(data: Data): Date {
        return new Date(data.integer);
    }
}

// Fix encoding of dates
declare global {
    interface Date {
        encode: (context: EncodeContext) => number;
    }
}

Date.prototype.encode = function (this: Date, context: EncodeContext): number {
    return this.getTime();
};

// We export an instance to prevent creating a new instance every time we need to decode a number
export default new DateDecoder();
