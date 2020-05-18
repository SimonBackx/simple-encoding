import { PatchableArray } from "./PatchableArray";
import { Patchable } from "../classes/Patchable";
import { Identifiable } from "../classes/Identifiable";

class Patch implements Patchable<Patch, Patch>, Identifiable<string> {
    id: string;
    name?: string;
    description?: string;

    constructor(data: { id: string; name?: string; description?: string }) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
    }

    getIdentifier() {
        return this.id;
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
}

class Put implements Patchable<Patch, Put>, Identifiable<string> {
    id: string;
    name: string;
    description: string;

    constructor(data: { id: string; name: string; description: string }) {
        this.id = data.id;
        this.name = data.name;
        this.description = data.description;
    }

    getIdentifier() {
        return this.id;
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
    });
});
