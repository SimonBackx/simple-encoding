import { field } from "../decorators/Field";
import { ArrayDecoder } from "../structs/ArrayDecoder";
import IntegerDecoder from "../structs/IntegerDecoder";
import StringDecoder from "../structs/StringDecoder";
import { AutoEncoder } from "./AutoEncoder";
import { Cloneable, cloneObject } from "./Cloneable";

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

    /// Test support and compile support for getIdentifier (should work with and without it)
    getIdentifier(): number {
        return parseInt(this.id.substring(3))
    }
}

describe("Cloneable", () => {
    test("Clone an AutoEncoder object", () => {
        const aFriend = Dog.create({ id: "DOG2", name: "friend", friendIds: [], friends: [] });
        const dog = Dog.create({ id: "DOG1", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [aFriend] });
        expect(aFriend.clone()).toEqual(aFriend);
        expect(dog.clone()).toEqual(dog);

        expect(dog.clone().patch).toBeDefined()
        expect(dog.clone()).toBeInstanceOf(Dog)
        expect(dog.clone().friends[0]).toBeInstanceOf(Dog)

        expect(dog.clone()).not.toBe(dog)
        expect(dog.clone().friends[0]).not.toBe(aFriend)
    });

    test("Clone an array", () => {
        const aFriend = Dog.create({ id: "DOG2", name: "friend", friendIds: [], friends: [] });
        const dog = Dog.create({ id: "DOG1", name: "dog", friendIds: ["sdgsdg", "84sdg95", "sdg95sdg26s"], friends: [aFriend] });
        expect(cloneObject([aFriend as Cloneable, dog as Cloneable, "test"])).toEqual([aFriend, dog, "test"]);
    });

    test("Clone a string", () => {
        expect(cloneObject("hallo")).toEqual("hallo");
    });

    test("Clone null", () => {
        expect(cloneObject(null)).toEqual(null);
    });

    test("Clone undefined", () => {
        expect(cloneObject(undefined)).toEqual(undefined);
    });

    test("Clone date", () => {
        const obj = new Date()
        expect(cloneObject(obj)).toEqual(obj);
        expect(cloneObject(obj)).not.toBe(obj);
    });

    test("Clone plain object", () => {
        const obj = {
            name: "Test",
            id: 1234,
            randomValue: undefined
        }
        expect(cloneObject(obj)).toEqual(obj);
        expect(cloneObject(obj)).not.toBe(obj);
    });
});
