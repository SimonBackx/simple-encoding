import { PatchableArray } from "./PatchableArray";

describe("PatchableArray", () => {
    test("Integer based array", () => {
        const currentValue = [8, 5, 3, 1];

        const patchableArray = new PatchableArray<number, number, number>();
        patchableArray.put(9, 3);

        console.warn(patchableArray.changes);
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
});
