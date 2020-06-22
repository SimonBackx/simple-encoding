import { Data } from "./Data";
import { PatchType, Patchable } from './Patchable';

export interface Decoder<T> {
    decode(data: Data): T;
}

