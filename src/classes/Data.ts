import { Decoder } from "./Decoder";

/// Decode data that is structured in maps and arrays
export interface Data {
    readonly string: string;
    readonly number: number;
    readonly integer: number;
    readonly boolean: boolean;
    readonly value: any;
    readonly base64: string;
    readonly key: string;

    version?: number;

    /// Contains the path where we are reading
    readonly currentField: string;
    addToCurrentField(field: string | number): string;

    field(field: string): Data;
    optionalField(field: string): Data | undefined;
    index(number: number): Data;
    decode<T>(decoder: Decoder<T>): T;
    equals<T>(value: T): T;
    array<T>(decoder: Decoder<T>): T[];
    enum<E extends { [key: number]: string | number }>(e: E): E[keyof E];
}
