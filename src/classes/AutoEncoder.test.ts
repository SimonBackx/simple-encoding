import { AutoEncoder } from "./AutoEncoder";
import { field } from "../decorators/Field";
import StringDecoder from "../structs/StringDecoder";
import { ObjectData } from "./ObjectData";
import { ArrayDecoder } from "../structs/ArrayDecoder";
import { PatchableArray } from "../structs/PatchableArray";
import { Encodeable } from "./Encodeable";
import { Patchable, PatchType } from "./Patchable";
import { Identifiable, IdentifiableType } from "./Identifiable";

class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id: string;

    @field({ decoder: StringDecoder })
    @field({ decoder: StringDecoder, version: 2, field: "breed" })
    name: string | undefined;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    friendIds: string[];

    @field({ decoder: new ArrayDecoder(Dog) })
    friends: Dog[];
}
const DogPatch = Dog.patchType();

describe("AutoEncoder", () => {
    test("encoding works and version support", () => {
        const aFriend = Dog.create({ id: "b", name: "friend", friendIds: [], friends: [] });
        const dog = Dog.create({ id: "a", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [aFriend] });
        expect(dog.encode()).toEqual({
            id: "a",
            breed: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ id: "b", breed: "friend", friendIds: [], friends: [] }],
        });
        expect(dog.encode(1)).toEqual({
            id: "a",
            name: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ id: "b", name: "friend", friendIds: [], friends: [] }],
        });
        expect(dog.encode(2)).toEqual({
            id: "a",
            breed: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ id: "b", breed: "friend", friendIds: [], friends: [] }],
        });
    });

    test("decoding and version support", () => {
        const data1 = new ObjectData(
            {
                id: "a",
                name: "version test",
                friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
                friends: [{ id: "b", name: "friend", friendIds: [], friends: [] }],
            },
            "",
            1
        );
        const data2 = new ObjectData(
            {
                id: "a",
                breed: "version test",
                friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
                friends: [{ id: "b", breed: "friend", friendIds: [], friends: [] }],
            },
            "",
            2
        );

        const dog1 = Dog.decode(data1);
        const dog2 = Dog.decode(data2);

        expect(dog1).toEqual(dog2);
        expect(dog1).toEqual({
            id: "a",
            name: "version test",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ id: "b", name: "friend", friendIds: [], friends: [], latestVersion: 2 }],
            latestVersion: 2,
        });
    });

    test("Automatic patch instances", () => {
        const friendDog = Dog.create({ id: "b", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [] });
        const friendDogChanged = Dog.create({ id: "b", name: "My best friend", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [] });

        const dog = Dog.create({ id: "a", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [] });

        const patchDog = DogPatch.create({ id: "a", name: "Change name" });
        patchDog.friendIds.addDelete("84sdg95");
        patchDog.friendIds.addPut("test", "sdgsdg");
        patchDog.friends.addPut(friendDog, null);

        const friendPatch = DogPatch.create({ id: "b", name: "My best friend" });
        patchDog.friends.addPatch(friendPatch);

        const patched = dog.patch(patchDog);

        expect(patched).toEqual(Dog.create({ id: "a", name: "Change name", friendIds: ["sdgsdg", "test", "sdg95sdg26s"], friends: [friendDogChanged] }));

        expect(patchDog.latestVersion).toEqual(Dog.latestVersion);

        // Test if patchable items are encodeable
        expect(patchDog.encode()).toEqual({
            id: "a",
            breed: "Change name",
            friendIds: [
                {
                    delete: "84sdg95",
                },
                {
                    put: "test",
                    afterId: "sdgsdg",
                },
            ],
            friends: [
                {
                    put: friendDogChanged.encode(),
                    afterId: null,
                },
            ],
        });

        // Test if patchable items are encodeable
        expect(patchDog.encode(1)).toEqual({
            id: "a",
            name: "Change name",
            friendIds: [
                {
                    delete: "84sdg95",
                },
                {
                    put: "test",
                    afterId: "sdgsdg",
                },
            ],
            friends: [
                {
                    put: friendDogChanged.encode(1),
                    afterId: null,
                },
            ],
        });

        // Test if patchable items are decodeable
        expect(DogPatch.decode(new ObjectData(patchDog.encode()))).toEqual(patchDog);
        expect(DogPatch.decode(new ObjectData(patchDog.encode(1), "", 1))).toEqual(patchDog);
        expect(DogPatch.decode(new ObjectData(patchDog.encode(2), "", 2))).toEqual(patchDog);
    });
});

type T = PatchType<Dog>;
