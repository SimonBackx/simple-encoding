export class DecodingError extends Error {
    id?: string;
    /**
     * A code that identifies this error type.
     */
    code: string;
    message: string;

    /**
     * A human readable error message (optional)
     */
    human: string | undefined;

    /**
     * The field where the error occured during decoding.
     * E.g.
     * animals.0.name
     */
    field: string | undefined;

    constructor(error: { code: string; message: string; human?: string; field?: string }) {
        super(error.message);
        this.code = error.code;
        this.message = error.message;
        this.human = error.human;
        this.field = error.field;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, DecodingError);
        }
    }

    toString(): string {
        return this.code + ": " + this.message + (this.field ? " at " + this.field : "");
    }

    addNamespace(field: string) {
        this.field = this.field ? field + "." + this.field : field;
    }
}
