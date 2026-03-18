import { AutoEncoder } from '../classes/AutoEncoder';

export function isAutoEncoder(obj: unknown): obj is AutoEncoder {
    return /* obj instanceof AutoEncoder || */ (typeof obj === 'object' && obj !== null && (obj as any)._isAutoEncoder);
}
