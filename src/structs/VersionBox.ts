import { Data } from '../classes/Data';
import { Decoder } from '../classes/Decoder';
import { Encodeable } from '../classes/Encodeable';
import { EncodeContext } from '../classes/EncodeContext';

/**
 * When you need to store data for a long period, a VersionBox can be very usefull. It saves the version of the data in it's encoding.
 * During decoding, it reads the version and continues decoding the data using the provided version instead of the version in the context.
 */
export class VersionBox<T extends Encodeable> implements Encodeable {
    data: T;

    constructor(data: T) {
        this.data = data
    }

    encode(context: EncodeContext) {
        return {
            data: this.data.encode(context),
            version: context.version
        }
    }

}


export class VersionBoxDecoder<T extends Encodeable> implements Decoder<VersionBox<T>> {
    decoder: Decoder<T>;

    constructor(decoder: Decoder<T>) {
        this.decoder = decoder;
    }

    decode(data: Data): VersionBox<T> {
        // Set the version of the decoding context of "data"
        const context = data.field("data")
        context.context.version = data.field("version").integer

        return new VersionBox<T>(context.decode(this.decoder))
    }
}
