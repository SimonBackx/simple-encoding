import { DecodingError } from "./DecodingError";

// Error that is caused by a client and should be reported to the client
export class DecodingErrors extends Error {
    errors: DecodingError[];

    constructor(...errors: DecodingError[]) {
        super(errors.map(e => e.toString()).join("\n"));
        this.errors = errors;
    }

    addError(error: DecodingError | DecodingErrors) {
        if (error instanceof DecodingError) {
            this.errors.push(error);
            this.message += "\n" + error.toString();
        } else if (error instanceof DecodingErrors) {
            this.errors.push(...error.errors)
            this.message += "\n" + error.toString();
        } else {
            throw new Error("Unsupported addError")
        }
    }

    removeErrorAt(index: number) {
        this.errors.splice(index, 1)
    }

    addNamespace(field: string) {
        this.errors.forEach(e => {
            e.field = e.field ? e.field + "." + field : field;
        });
    }

    throwIfNotEmpty() {
        if (this.errors.length > 0) {
            throw this;
        }
    }
}
