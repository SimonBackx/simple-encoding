export enum EncodeMedium {
    /**
     * The object will be sent over the network.
     */
    Network = 'Network',

    /**
     * The object will be stored in the database.
     */
    Database = 'Database',
}

export interface EncodeContext {
    version: number;
    references?: Map<any, Map<string | number, any>>; // class type -> id -> decoded object

    /**
     * When encoding, this is the storage type we encode to.
     * When deconding, this is the storage type we decode from.
     */
    medium?: EncodeMedium;
}
