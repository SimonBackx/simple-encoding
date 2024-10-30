import { field } from "../decorators/Field.js";
import { ArrayDecoder } from "../structs/ArrayDecoder.js";
import StringDecoder from "../structs/StringDecoder.js";
import { AutoEncoder } from "./AutoEncoder.js";

class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = "";

    @field({ decoder: StringDecoder })
    name = "";

    @field({ decoder: new ArrayDecoder(Dog) })
    children: Dog[] = [];
}

class Cat extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = "";

    @field({ decoder: StringDecoder })
    name = "";

    @field({ decoder: Cat, nullable: true })
    mother: Cat | null = null;
}

describe('DeepSet', () => {
    it('Reuses references to objects, but updates their data', () => {
        const babyCat = new Cat(); 
        babyCat.id = "1";
        babyCat.name = "Baby Cat";

        const cat = new Cat();
        cat.id = "2";
        cat.name = "Cat";

        babyCat.mother = cat;

        // Do a deep set, where the name of the baby cat and cat has changed

        const babyCatChanged = new Cat(); 
        babyCatChanged.id = "1";
        babyCatChanged.name = "Baby Cat 2";

        const catChanged = new Cat();
        catChanged.id = "2";
        catChanged.name = "Cat 2";

        babyCatChanged.mother = catChanged;

        // Deep set
        babyCat.deepSet(babyCatChanged);

        // Check reference to mother remained equal
        expect(babyCat === babyCatChanged).toBe(false);

        // Reference to mother should be the same
        expect(babyCat.mother === cat).toBe(true);

        // Mother data should be updated
        expect(cat.name).toBe("Cat 2");
        expect(babyCat.name).toBe("Baby Cat 2");
    });

    it('Reuses references to arrays and updates objects', () => {
        const motherDog = new Dog();
        motherDog.id = "1";
        motherDog.name = "Mother Dog";

        const originalArray = motherDog.children;

        const dog2 = new Dog();
        dog2.id = "2";
        dog2.name = "Dog 2";
        motherDog.children.push(dog2);

        const dog3 = new Dog();
        dog3.id = "3";
        dog3.name = "Dog 3";
        motherDog.children.push(dog3);

        const updatedMotherDog = new Dog();
        updatedMotherDog.id = "1";
        updatedMotherDog.name = "Mother Dog Updated";

        const updatedDog2 = new Dog();
        updatedDog2.id = "2";
        updatedDog2.name = "Dog 2 Updated";
        updatedMotherDog.children.push(updatedDog2);

        // Dog 3 is removed

        // New dog 4
        const updatedDog4 = new Dog();
        updatedDog4.id = "4";
        updatedDog4.name = "Dog 4";
        updatedMotherDog.children.push(updatedDog4);

        // Deep set mother
        motherDog.deepSet(updatedMotherDog);

        // Check reference to array is deep equal
        expect(motherDog.children === originalArray).toBe(true);
        expect(motherDog.children.length).toBe(2);

        // Check dog2 is changed
        expect(motherDog.children[0] === dog2).toBe(true);
        expect(dog2.name).toBe("Dog 2 Updated");

        // Check dog4 is added
        expect(motherDog.children[1] === updatedDog4).toBe(true);
        expect(updatedDog4.name).toBe("Dog 4");
    });
});