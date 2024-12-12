import { Data } from "./Data.js";
import { PlainObject } from "./Encodeable.js";
import { EncodeContext } from "./EncodeContext.js";

export interface Decoder<T> {
    decode(data: Data): T;

    /**
     * Optionanl custom encoder
     */
    encode?(data: T, context: EncodeContext): PlainObject

    /**
     * Optiona
     */
    getDefaultValue?(): T;
    isDefaultValue?(value: unknown): boolean;
}

