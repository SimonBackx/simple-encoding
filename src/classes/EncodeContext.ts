export interface EncodeContext {
    version: number;
    references?: Map<any, Map<string|number, any>>; // class type -> id -> decoded object
}
