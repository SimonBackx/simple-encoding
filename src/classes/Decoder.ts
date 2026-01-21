import { SimpleError } from '@simonbackx/simple-errors';
import { AutoEncoder } from './AutoEncoder.js';
import { Data } from './Data.js';
import { PlainObject } from './Encodeable.js';
import { EncodeContext } from './EncodeContext.js';

export interface Decoder<T> {
    decode(data: Data): T;

    /**
     * Optionanl custom encoder
     */
    encode?(data: T, context: EncodeContext): PlainObject;

    /**
     * Optiona
     */
    getDefaultValue?(): T | undefined;
    isDefaultValue?(value: unknown): boolean;
}

export type DecodedType<D> = D extends typeof AutoEncoder ? InstanceType<D> : (D extends Decoder<infer C> ? C : never);
