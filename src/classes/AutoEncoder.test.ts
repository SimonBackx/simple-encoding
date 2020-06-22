import { field } from "../decorators/Field";
import { ArrayDecoder } from "../structs/ArrayDecoder";
import IntegerDecoder from "../structs/IntegerDecoder";
import StringDecoder from "../structs/StringDecoder";
import { AutoEncoder } from "./AutoEncoder";
import { ObjectData } from "./ObjectData";
import { PatchType } from './Patchable';
import { EnumDecoder } from '../structs/EnumDecoder';

enum PaymentMethod {
    PointOfSale = "PointOfSale",
    CreditCard = "CreditCard",
    Bancontact = "Bancontact",
    Payconiq = "Payconiq",
    IDeal = "IDeal",
    ApplePay = "ApplePay"
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
}
const DogPatch = Dog.patchType();

describe("AutoEncoder", () => {
    test("encoding works and version support", () => {
        const aFriend = Dog.create({ id: "DOG2", name: "friend", friendIds: [], friends: [] });
        const dog = Dog.create({ id: "DOG1", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [aFriend] });
        expect(dog.encode({ version: 1 })).toEqual({
            id: 1,
            name: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ id: 2, name: "friend", friendIds: [], friends: [] }],
        });
        expect(dog.encode({ version: 2 })).toEqual({
            id: "DOG1",
            breed: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ id: "DOG2", breed: "friend", friendIds: [], friends: [] }],
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
});
