import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";
import { EncodeContext } from "../classes/EncodeContext";

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
