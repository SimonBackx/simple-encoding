import { SimpleError } from '@simonbackx/simple-errors';
import { Data } from '../classes/Data';
import { Decoder } from '../classes/Decoder';

export class SymbolDecoder<T, E extends symbol> implements Decoder<T | E> {
    symbol: E;
    decoder: Decoder<T>;

    private key: string;

    constructor(decoder: Decoder<T>, e: E) {
        this.decoder = decoder;
        this.symbol = e;
        const k = Symbol.keyFor(e);

        if (!k) {
            throw new Error('Symbol must be a registered symbol in order to be encodeable. Create a new symbol with Symbol.for("key")');
        }
        this.key = k;
    }

    decode(data: Data): T | E {
        const field = data.optionalField('$symbol');

        if (!field) {
            return this.decoder.decode(data);
        }

        const s = field.string;
        if (s === this.key) {
            return this.symbol;
        }

        throw new SimpleError({
            code: 'invalid_field',
            message: `Unknown symbol value '${s}', expected '${this.key}'`,
            field: data.currentField,
        });
    }
}
