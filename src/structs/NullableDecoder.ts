import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";

export class NullableDecoder<T> implements Decoder<T | null> {
    decoder: Decoder<T>;

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    decode(data: Data): T | null {
        if (data.value === null) {
            return null;
        }

        return data.decode(this.decoder);
    }
}
