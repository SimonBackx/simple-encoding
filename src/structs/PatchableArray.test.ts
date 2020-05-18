import { PatchableArray, PatchableArrayDecoder } from "./PatchableArray";
import { Patchable } from "../classes/Patchable";
import { Identifiable } from "../classes/Identifiable";
import StringDecoder from "./StringDecoder";
import { Data } from "../classes/Data";
import { ObjectData } from "../classes/ObjectData";

class Patch implements Patchable<Patch, Patch> {
    id: string;
    name?: string;
    description?: string;

    constructor(data: { id: string; name?: string; description?: string }) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
    }

    patch(patch: Patch): Patch {
        return new Patch({
            id: this.id,
            name: patch.name ?? this.name,
            description: patch.description ?? this.description,
        });
    }

    encode() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
        };
    }

    static decode(data: Data): Patch {
        return new Patch({
            id: data.field("id").string,
            name: data.optionalField("name")?.string,
            description: data.optionalField("description")?.string,
        });
    }
}

class Put implements Patchable<Patch, Put> {
    id: string;
    name: string;
    description: string;

    constructor(data: { id: string; name: string; description: string }) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
    }

    patch(patch: Patch): Put {
        return new Put({
            id: this.id,
            name: patch.name ?? this.name,
            description: patch.description ?? this.description,
        });
    }

    encode() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
        };
    }

    static decode(data: Data): Put {
        return new Put({
            id: data.field("id").string,
            name: data.field("name").string,
            description: data.field("description").string,
        });
    }
}

describe("PatchableArray", () => {
    test("Integer based array", () => {
        const currentValue = [8, 5, 3, 1];

        const patchableArray = new PatchableArray<number, number, number>();
        patchableArray.put(9, 3);

        expect(patchableArray.applyTo(currentValue)).toEqual([8, 5, 3, 9, 1]);

        patchableArray.put(10, 9);
        patchableArray.put(11, 9);

        expect(patchableArray.applyTo(currentValue)).toEqual([8, 5, 3, 9, 11, 10, 1]);

        patchableArray.delete(3);

        expect(patchableArray.applyTo(currentValue)).toEqual([8, 5, 9, 11, 10, 1]);

        patchableArray.move(8, 1);

        expect(patchableArray.applyTo(currentValue)).toEqual([5, 9, 11, 10, 1, 8]);

        patchableArray.move(1, null);

        expect(patchableArray.applyTo(currentValue)).toEqual([1, 5, 9, 11, 10, 8]);
        patchableArray.put(12, null);
        expect(patchableArray.applyTo(currentValue)).toEqual([12, 1, 5, 9, 11, 10, 8]);
    });

    test("Object based array", () => {
        const currentValue = [];

        const patchableArray = new PatchableArray<string, Put, Patch>();

        const A = new Put({ id: "A", name: "Letter A", description: "This is a letter" });
        const B = new Put({ id: "B", name: "Letter B", description: "This is a letter" });
        const BResult = new Put({ id: "B", name: "Letter B", description: "This is the best letter" });

        patchableArray.put(A, null);
        expect(patchableArray.applyTo(currentValue)).toEqual([A]);

        patchableArray.put(B, A.id);
        expect(patchableArray.applyTo(currentValue)).toEqual([A, B]);

        const betterDescription = new Patch({ id: "B", description: "This is the best letter" });
        patchableArray.patch(betterDescription);
        expect(patchableArray.applyTo(currentValue)).toEqual([A, BResult]);

        patchableArray.move(A.id, B.id);
        expect(patchableArray.applyTo(currentValue)).toEqual([BResult, A]);

        patchableArray.delete(B.id);
        expect(patchableArray.applyTo(currentValue)).toEqual([A]);

        // Test the decoding and encoding
        const encoded = patchableArray.encode();
        const decoder = new PatchableArrayDecoder(Put, Patch, StringDecoder);
        const decoded = decoder.decode(new ObjectData(encoded));
        expect(decoded).toEqual(patchableArray);

        // Check if still results in the same result
        expect(decoded.applyTo(currentValue)).toEqual([A]);
    });
});
