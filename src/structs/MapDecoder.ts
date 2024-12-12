import { SimpleError } from "@simonbackx/simple-errors";

import { Data } from "../classes/Data.js";
import { Decoder } from "../classes/Decoder.js";
import { NullableDecoder } from "./NullableDecoder.js";
import { PatchMap } from "../classes/Patchable.js";
import { PatchOrPutDecoder } from "../classes/AutoEncoder.js";

export class MapDecoder<A, B> implements Decoder<Map<A, B>> {
    keyDecoder: Decoder<A>;
    valueDecoder: Decoder<B>;

    constructor(keyDecoder: Decoder<A>, valueDecoder: Decoder<B>) {
        this.keyDecoder = keyDecoder
        this.valueDecoder = valueDecoder
    }

    patchType() {
        const elementDecoder = this.valueDecoder;
        if ((elementDecoder as any).patchType) {
            const patchDecoder = (elementDecoder as any).patchType();
            return new PatchMapDecoder(this.keyDecoder, new NullableDecoder(new PatchOrPutDecoder(this.valueDecoder as any, patchDecoder)))
        }

        return new PatchMapDecoder(this.keyDecoder, new NullableDecoder(this.valueDecoder))
    }

    patchDefaultValue() {
        return new PatchMap()
    }

    decode(data: Data): Map<A, B> {
        if (typeof data.value === 'object' && data.value !== null) {
            const map = new Map<A, B>()
            for (const key in data.value) {
                const keyDecoded = data.clone({ 
                    data: key, 
                    context: data.context, 
                    field: data.addToCurrentField(key) 
                }).decode(this.keyDecoder)
                const valueDecoded = data.field(key).decode(this.valueDecoder)
                map.set(keyDecoded, valueDecoded)
            }
            return map
        }

        throw new SimpleError({
            code: "invalid_field",
            message: `Expected an object at ${data.currentField}`,
            field: data.currentField,
        });
    }

    isDefaultValue(value: unknown): boolean {
        return value instanceof Map && value.size === 0
    }

    getDefaultValue(): Map<A, B> {
        return new Map()
    }
}

export class PatchMapDecoder<A, B> implements Decoder<PatchMap<A, B>> {
    keyDecoder: Decoder<A>;
    valueDecoder: Decoder<B>;

    constructor(keyDecoder: Decoder<A>, valueDecoder: Decoder<B>) {
        this.keyDecoder = keyDecoder
        this.valueDecoder = valueDecoder
    }

    decode(container: Data): PatchMap<A, B> {
        const data = container.field('changes')

        if (typeof data.value === 'object' && data.value !== null) {
            const map = new PatchMap<A, B>()
            for (const key in data.value) {
                const keyDecoded = data.clone({ 
                    data: key, 
                    context: data.context, 
                    field: data.addToCurrentField(key) 
                }).decode(this.keyDecoder)
                const valueDecoded = data.field(key).decode(this.valueDecoder)
                map.set(keyDecoded, valueDecoded)
            }
            return map
        }

        throw new SimpleError({
            code: "invalid_field",
            message: `Expected an object at ${data.currentField}`,
            field: data.currentField,
        });
    }

    isDefaultValue(value: unknown): boolean {
        return value instanceof PatchMap && value.size === 0
    }

    getDefaultValue(): PatchMap<A, B> {
        return new PatchMap()
    }
}