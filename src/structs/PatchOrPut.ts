import { Data } from '../classes/Data';
import { Decoder } from '../classes/Decoder';
import { Encodeable } from '../classes/Encodeable';
import { EncodeContext } from '../classes/EncodeContext';
import { Patchable } from '../classes/Patchable';

export class PatchOrPut<Put extends Patchable<Patch> & Encodeable, Patch extends Patchable<Patch> & Encodeable> implements Encodeable, Patchable<PatchOrPut<Put, Patch>> {
    value: Patch | Put
    isPut = false

    get isPatch() {
        return !this.isPut
    }

    constructor(value: Patch | Put, isPut = false) {
        this.value = value
        this.isPut = isPut
    }

    patch(this: PatchOrPut<Put, Patch>, patch: PatchOrPut<Put, Patch>): this {
        if (patch.isPut) {
            return patch as any
        }

        return this.value.patch(patch.getPatch()!) as any
    }

    encode(context: EncodeContext) {
        if (this.isPut) {
            return {
                _put: this.value.encode(context)
            }
        }

        return this.value.encode(context)
    }

    static patch<Put extends Patchable<Patch> & Encodeable, Patch extends Patchable<Patch> & Encodeable>(value: Patch) {
        return new this<Put, Patch>(value, false)
    }

    static put<Put extends Patchable<Patch> & Encodeable, Patch extends Patchable<Patch> & Encodeable>(value: Put) {
        return new this<Put, Patch>(value, true)
    }

    getPatch(): Patch | undefined {
        if (!this.isPatch) {
            return undefined
        }
        return this.value as Patch
    }

    getPut(): Put | undefined {
        if (!this.isPut) {
            return undefined
        }
        return this.value as Put
    }

    static apply<Put extends Patchable<Patch> & Encodeable, Patch extends Patchable<Patch> & Encodeable>(value: Put, patchOrPut: PatchOrPut<Put, Patch> | Patch): Put {
        if (patchOrPut instanceof PatchOrPut) {
            if (patchOrPut.isPut) {
                return patchOrPut.value as Put
            }
            return value.patch(patchOrPut.getPatch()!)
        }
        return value.patch(patchOrPut)
    }
}

export class PatchOrPutDecoder<Put extends Patchable<Patch> & Encodeable, Patch extends Patchable<Patch> & Encodeable> implements Decoder<PatchOrPut<Put, Patch>> {
    putDecoder: Decoder<Put>;
    patchDecoder: Decoder<Patch>;

    constructor(putDecoder: Decoder<Put>, patchDecoder: Decoder<Patch>) {
        this.putDecoder = putDecoder;
        this.patchDecoder = patchDecoder;
    }

    decode(data: Data): PatchOrPut<Put, Patch> {
        const put = data.optionalField("_put")
        if (put) {
            return PatchOrPut.put<Put, Patch>(put.decode(this.putDecoder))
        }

        const patch = data
        return PatchOrPut.patch<Put, Patch>(patch.decode(this.patchDecoder))
    }
}
