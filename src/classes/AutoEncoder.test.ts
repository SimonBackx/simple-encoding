/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { Decoder, PatchType } from '@simonbackx/simple-encoding';

import { field } from "../decorators/Field";
import { ArrayDecoder } from "../structs/ArrayDecoder";
import { EnumDecoder } from '../structs/EnumDecoder';
import IntegerDecoder from "../structs/IntegerDecoder";
import { PatchableArray } from '../structs/PatchableArray';
import StringDecoder from "../structs/StringDecoder";
import { AutoEncoder } from "./AutoEncoder";
import { Data } from './Data';
import { Encodeable } from './Encodeable';
import { EncodeContext } from './EncodeContext';
import { ObjectData } from "./ObjectData";
import { PatchableArrayAutoEncoder } from './Patchable';

enum PaymentMethod {
    PointOfSale = "PointOfSale",
    CreditCard = "CreditCard",
    Bancontact = "Bancontact",
    Payconiq = "Payconiq",
    IDeal = "IDeal",
    ApplePay = "ApplePay"
}

class NotPatchable implements Encodeable {
    id = ""
    constructor(id: string) {
        this.id = id
    }

    encode(encode: EncodeContext) {
        return {
            id: this.id
        }
    }

    static decode(data: Data) {
        return new NotPatchable(data.field("id").string)
    }
}


class Dog extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    @field({ decoder: StringDecoder, version: 2, upgrade: (int: number) => "DOG" + int, downgrade: (str: string) => parseInt(str.substring(3)) })
    id = "";

    @field({ decoder: StringDecoder })
    @field({ decoder: StringDecoder, version: 2, field: "breed", defaultValue: () => "" })
    name: string | undefined;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    friendIds: string[] = [];

    @field({ decoder: new ArrayDecoder(Dog) })
    friends: Dog[] = [];

    @field({ decoder: Dog, optional: true })
    bestFriend?: Dog;

    @field({ decoder: new EnumDecoder(PaymentMethod), optional: true })
    test?: PaymentMethod;

    /// Test support and compile support for getIdentifier (should work with and without it)
    getIdentifier(): number {
        return parseInt(this.id.substring(3))
    }
}
const DogPatch = Dog.patchType();

class Dog2 extends AutoEncoder {
    @field({ decoder: IntegerDecoder })
    @field({ decoder: StringDecoder, version: 2, upgrade: (int: number) => "DOG" + int, downgrade: (str: string) => parseInt(str.substring(3)) })
    id = "";

    @field({ decoder: StringDecoder })
    @field({ decoder: StringDecoder, version: 2, field: "breed", defaultValue: () => "" })
    name: string | undefined;

    @field({ decoder: new ArrayDecoder(StringDecoder) })
    friendIds: string[] = [];

    @field({ decoder: new ArrayDecoder(Dog) })
    friends: Dog[] = [];

    @field({ decoder: new ArrayDecoder(NotPatchable) })
    notPatchableFriends: NotPatchable[] = [];

    @field({ decoder: Dog, optional: true })
    bestFriend?: Dog;

    @field({ decoder: new EnumDecoder(PaymentMethod), optional: true })
    test?: PaymentMethod;
}
const Dog2Patch = Dog2.patchType();

describe("AutoEncoder", () => {
    test("encoding works and version support", () => {
        const aFriend = Dog.create({ id: "DOG2", name: "friend", friendIds: [], friends: [] });
        const dog = Dog.create({ id: "DOG1", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [aFriend] });
        expect(dog.encode({ version: 1 })).toEqual({
            _isPatch: false,
            id: 1,
            name: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ _isPatch: false, id: 2, name: "friend", friendIds: [], friends: [] }],
        });
        expect(dog.encode({ version: 2 })).toEqual({
            _isPatch: false,
            id: "DOG1",
            breed: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ _isPatch: false, id: "DOG2", breed: "friend", friendIds: [], friends: [] }],
        });
    });

    test("decoding and version support", () => {
        const data1 = new ObjectData(
            {
                id: 1,
                name: "version test",
                friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
                friends: [{ id: 2, name: "friend", friendIds: [], friends: [] }],
            },
            { version: 1 }
        );
        const data2 = new ObjectData(
            {
                id: "DOG1",
                breed: "version test",
                friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
                friends: [{ id: "DOG2", breed: "friend", friendIds: [], friends: [] }],
            },
            { version: 2 }
        );

        const dog1 = Dog.decode(data1);
        const dog2 = Dog.decode(data2);

        expect(dog1).toEqual(dog2);
        expect(dog1).toEqual({
            id: "DOG1",
            name: "version test",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ id: "DOG2", name: "friend", friendIds: [], friends: [] }],
        });
    });

    test("if ids are not automatically converted correctly", () => {
        expect(parseInt("DOG1")).toBeNaN();
    });

    test("Automatic patch instances", () => {
        const existingFriendBestFriend = Dog.create({ id: "DOG4", name: "best friend", friendIds: [], friends: [] });

        const existingFriend = Dog.create({
            id: "DOG3",
            name: "existing friend",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [],
            // this is needed to test if existing relations are left unchanged on patches
            bestFriend: existingFriendBestFriend,
        });
        const friendDog = Dog.create({ id: "DOG2", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [] });
        const friendDogChanged = Dog.create({ id: "DOG2", name: "My best friend", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [] });
        const existingFriendChanged = Dog.create({
            id: "DOG3",
            name: "My not good friend",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [],
            bestFriend: existingFriendBestFriend,
        });

        const dog = Dog.create({ id: "DOG1", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [existingFriend] });

        const shouldCompile = DogPatch.create({ id: "DOG1" });
        let patchDog = DogPatch.create({ id: "DOG1", name: "Change name" });
        patchDog = shouldCompile.patch(patchDog);

        patchDog.friendIds.addDelete("84sdg95");
        patchDog.friendIds.addPut("test", "sdgsdg");
        patchDog.friends.addPut(friendDog, null);

        const friendPatch = DogPatch.create({ id: "DOG2", name: "My best friend" });
        patchDog.friends.addPatch(friendPatch);

        const friendPatchExist = DogPatch.create({ id: "DOG3", name: "My not good friend" });

        patchDog.friends.addPatch(friendPatchExist);

        const patched = dog.patch(patchDog);

        expect(patched).toEqual(
            Dog.create({ id: "DOG1", name: "Change name", friendIds: ["sdgsdg", "test", "sdg95sdg26s"], friends: [friendDogChanged, existingFriendChanged] })
        );

        // Test if patchable items are encodeable
        expect(patchDog.encode({ version: 2 })).toEqual({
            _isPatch: true,
            id: "DOG1",
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
                    put: friendDogChanged.encode({ version: 2 }),
                    afterId: null,
                },
                {
                    patch: friendPatchExist.encode({ version: 2 }),
                },
            ],
        });

        // Test if patchable items are encodeable
        expect(patchDog.encode({ version: 1 })).toEqual({
            _isPatch: true,
            id: 1,
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
                    put: friendDogChanged.encode({ version: 1 }),
                    afterId: null,
                },
                {
                    patch: friendPatchExist.encode({ version: 1 }),
                },
            ],
        });

        // Test if patchable items are decodeable
        expect(DogPatch.decode(new ObjectData(patchDog.encode({ version: 1 }), { version: 1 }))).toEqual(patchDog);
        expect(DogPatch.decode(new ObjectData(patchDog.encode({ version: 2 }), { version: 2 }))).toEqual(patchDog);
    });

    test("Patchable array", () => {
        const arr: PatchableArrayAutoEncoder<Dog> = new PatchableArray()
        const friendDog = Dog.create({ id: "DOG2", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [] });
        arr.addPut(friendDog, 3)

        const clean: Dog[] = []
        expect(arr.applyTo(clean)).toEqual([friendDog])
    });

    test("Patchable array 2", () => {
        const arr: PatchableArrayAutoEncoder<Dog2> = new PatchableArray()
        const friendDog = Dog2.create({ id: "DOG2", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [] });
        arr.addPut(friendDog, "DOG3")

        const clean: Dog2[] = []
        expect(arr.applyTo(clean)).toEqual([friendDog])
    });

    test("Patch array fields by setting them", () => {
        const friendDog = Dog.create({ id: "DOG2", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [] });
        const patch = DogPatch.create({ friendIds: ["force-set"] as any })
        expect(friendDog.patch(patch).friendIds).toEqual(["force-set"])

        const test = Dog2.create({ id: "DOG2", name: "dog", notPatchableFriends: [new NotPatchable("test"), new NotPatchable("test2")], friends: [] });
        const patch2 = Dog2Patch.create({ notPatchableFriends: [new NotPatchable("hallo!")] })
        expect(test.patch(patch2).notPatchableFriends).toEqual([new NotPatchable("hallo!")])
    });

    test("Patch or put properties", () => {
        const existingFriendBestFriend = Dog.create({ id: "DOG4", name: "best friend", friendIds: [], friends: [] });

        const existingFriend = Dog.create({
            id: "DOG3",
            name: "existing friend",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [],
            // this is needed to test if existing relations are left unchanged on patches
            bestFriend: existingFriendBestFriend,
        });

        // Check if we can do a normal patch
        const patchDog = Dog.patch({ bestFriend: Dog.patch({ name: "Best friend 2" }) })
        const patchedDog = existingFriend.patch(patchDog);
        const patchedDog3 = existingFriend.patch({ name: "test" });

        expect(patchedDog.bestFriend!.name).toEqual("Best friend 2")
        expect(patchedDog.bestFriend!.id).toEqual("DOG4")

        // Check if we can do a put
        const patchDog2 = Dog.patch({ bestFriend: Dog.create({ id: "DOG5", name: "Better best friend", friendIds: [], friends: [
             Dog.create({ id: "DOG6", name: "Another friend", friendIds: [], friends: [] })
        ] }) })
        const patchedDog2 = existingFriend.patch(patchDog2);

        expect(patchedDog2.bestFriend!.name).toEqual("Better best friend")
        expect(patchedDog2.bestFriend!.id).toEqual("DOG5")

        // Try exactly the same by encdoing the patch and applying it again
        const encoded = patchDog2.encode({ version: 2 })
        const decoded = new ObjectData(encoded, { version: 2}).decode(DogPatch as Decoder<PatchType<Dog>>)
        const patchedDog2b = existingFriend.patch(decoded);
        expect(patchedDog2b).toEqual(patchedDog2)
    });
});
