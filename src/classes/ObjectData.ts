import { SimpleError } from "@simonbackx/simple-errors";

import { ArrayDecoder } from "../structs/ArrayDecoder";
import Base64Decoder from "../structs/Base64Decoder";
import BooleanDecoder from "../structs/BooleanDecoder";
import { EnumDecoder } from "../structs/EnumDecoder";
import IntegerDecoder from "../structs/IntegerDecoder";
import KeyDecoder from "../structs/KeyDecoder";
import { NullableDecoder } from "../structs/NullableDecoder";
import NumberDecoder from "../structs/NumberDecoder";
import StringDecoder from "../structs/StringDecoder";
import { Data } from "./Data";
import { Decoder } from "./Decoder";
import { EncodeContext } from "./EncodeContext";

/// Implementation of Data that reads an already existing tree of data.
export class ObjectData implements Data {
    data: any;
    currentField: string;
    context: EncodeContext;

    constructor(data: any, context: EncodeContext, currentField = "") {
        this.data = data;
        this.currentField = currentField;
        this.context = context;
    }

    addToCurrentField(field: string | number): string {
        if (this.currentField == "") {
            return field + "";
        }
        return this.currentField + "." + field;
    }

    get value(): any {
        return this.data;
    }

    get string(): string {
        return this.decode(StringDecoder);
    }

    get base64(): string {
        return this.decode(Base64Decoder);
    }

    get key(): string {
        return this.decode(KeyDecoder);
    }

    get number(): number {
        return this.decode(NumberDecoder);
    }

    get integer(): number {
        return this.decode(IntegerDecoder);
    }

    get boolean(): boolean {
        return this.decode(BooleanDecoder);
    }

    equals<T>(value: T): T {
        if (this.data !== value) {
            throw new SimpleError({
                code: "invalid_field",
                message: "Expected " + value,
                field: this.currentField,
            });
        }
        return value;
    }

    /**
     * Request an item at a given index. Expects a defined, non null value
     * @param number index
     */
    index(number: number): Data {
        if (Array.isArray(this.value)) {
            if (!Number.isSafeInteger(number)) {
                throw new SimpleError({
                    code: "invalid_index",
                    message: `Invalid index`,
                    field: this.currentField,
                });
            }
            if (this.data[number] !== undefined) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: `Expected value at ${this.addToCurrentField(number)}`,
                    field: this.addToCurrentField(number),
                });
            }
            return new ObjectData(this.data[number], this.context, this.addToCurrentField(number));
        }
        throw new SimpleError({
            code: "invalid_field",
            message: `Expected an array at ${this.currentField}`,
            field: this.currentField,
        });
    }

    /**
     * Expects an optional field that could be null. Always returns undefined if the field is null or undefined.
     */
    optionalField(field: string): Data | undefined {
        if (this.data && this.data[field] !== undefined && this.data[field] !== null) {
            return new ObjectData(this.data[field], this.context, this.addToCurrentField(field));
        }
    }

    /**
     * Expects an optional field that could be undefined. Returns Data if the field value is null or not undefined
     */
    undefinedField(field: string): Data | undefined {
        if (this.data && this.data[field] !== undefined) {
            return new ObjectData(this.data[field], this.context, this.addToCurrentField(field));
        }
    }

    /**
     * Expects an existing field that is defined and not null
     */
    field(field: string): Data {
        if (this.data && this.data[field] !== undefined) {
            return new ObjectData(this.data[field], this.context, this.addToCurrentField(field));
        }
        throw new SimpleError({
            code: "missing_field",
            message: `Field ${field} is expected at ${this.currentField}`,
            field: this.currentField,
        });
    }

    array<T>(decoder: Decoder<T>): T[] {
        return new ArrayDecoder(decoder).decode(this);
    }

    decode<T>(decoder: Decoder<T>): T {
        return decoder.decode(this);
    }

    nullable<T>(decoder: Decoder<T>): T | null {
        return new NullableDecoder(decoder).decode(this);
    }

    enum<E extends { [key: number]: string | number }>(e: E): E[keyof E] {
        return new EnumDecoder(e).decode(this);
    }
}
