import { AutoEncoder } from "./AutoEncoder";
import { field } from "../decorators/Field";
import StringDecoder from "../structs/StringDecoder";
import { ObjectData } from "./ObjectData";
import { ArrayDecoder } from "../structs/ArrayDecoder";

describe("AutoEncoder", () => {
    class Dog extends AutoEncoder {
        @field({ decoder: StringDecoder })
        @field({ decoder: StringDecoder, version: 2, field: "breed" })
        name: string;

        @field({ decoder: new ArrayDecoder(StringDecoder) })
        friendIds: string[];

        @field({ decoder: new ArrayDecoder(Dog) })
        friends: Dog[];
    }

    test("encoding works and version support", () => {
        const aFriend = Dog.create({ name: "friend", friendIds: [], friends: [] });
        const dog = Dog.create({ name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [aFriend] });
        expect(dog.encode()).toEqual({
            breed: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ breed: "friend", friendIds: [], friends: [] }],
        });
        expect(dog.encode(1)).toEqual({
            name: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ name: "friend", friendIds: [], friends: [] }],
        });
        expect(dog.encode(2)).toEqual({
            breed: "dog",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ breed: "friend", friendIds: [], friends: [] }],
        });
    });

    test("decoding and version support", () => {
        const data1 = new ObjectData(
            { name: "version test", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [{ name: "friend", friendIds: [], friends: [] }] },
            "",
            1
        );
        const data2 = new ObjectData(
            { breed: "version test", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [{ breed: "friend", friendIds: [], friends: [] }] },
            "",
            2
        );

        const dog1 = Dog.decode(data1);
        const dog2 = Dog.decode(data2);

        expect(dog1).toEqual(dog2);
        expect(dog1).toEqual({
            name: "version test",
            friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"],
            friends: [{ name: "friend", friendIds: [], friends: [], latestVersion: 2 }],
            latestVersion: 2,
        });
    });
});
