import { Data } from "./Data";
import { PlainObject } from "./Encodeable";
import { EncodeContext } from "./EncodeContext";

export interface Decoder<T> {
    decode(data: Data): T;

    /**
     * Optionanl custom encoder
     */
    encode?(data: T, context: EncodeContext): PlainObject
}

