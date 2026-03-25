import { field } from '../decorators/Field.js';
import { deepSet } from '../helpers/deepSet.js';
import { ArrayDecoder } from '../structs/ArrayDecoder.js';
import StringDecoder from '../structs/StringDecoder.js';
import { AutoEncoder } from './AutoEncoder.js';

class Dog extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: new ArrayDecoder(Dog) })
    children: Dog[] = [];
}

class Cat extends AutoEncoder {
    @field({ decoder: StringDecoder })
    id = '';

    @field({ decoder: StringDecoder })
    name = '';

    @field({ decoder: Cat, nullable: true })
    mother: Cat | null = null;
}

describe('DeepSet', () => {
    it('Reuses references to objects, but updates their data', () => {
        const babyCat = new Cat();
        babyCat.id = '1';
        babyCat.name = 'Baby Cat';

        const cat = new Cat();
        cat.id = '2';
        cat.name = 'Cat';

        babyCat.mother = cat;

        // Do a deep set, where the name of the baby cat and cat has changed

        const babyCatChanged = new Cat();
        babyCatChanged.id = '1';
        babyCatChanged.name = 'Baby Cat 2';

        const catChanged = new Cat();
        catChanged.id = '2';
        catChanged.name = 'Cat 2';

        babyCatChanged.mother = catChanged;

        // Deep set
        babyCat.deepSet(babyCatChanged);

        // Check reference to mother remained equal
        expect(babyCat === babyCatChanged).toBe(false);

        // Reference to mother should be the same
        expect(babyCat.mother === cat).toBe(true);

        // Mother data should be updated
        expect(cat.name).toBe('Cat 2');
        expect(babyCat.name).toBe('Baby Cat 2');
    });

    it('Works recursively in maps with same keys', () => {
        const babyCat = new Cat();
        babyCat.id = '1';
        babyCat.name = 'Baby Cat';

        const cat = new Cat();
        cat.id = '2';
        cat.name = 'Cat';

        babyCat.mother = cat;

        const babyCatChanged = new Cat();
        babyCatChanged.id = '1';
        babyCatChanged.name = 'Baby Cat 2';

        const catChanged = new Cat();
        catChanged.id = '2';
        catChanged.name = 'Cat 2';

        babyCatChanged.mother = catChanged;

        // Deep set
        const map1 = new Map([['a', babyCat]]);
        const map2 = new Map([['a', babyCatChanged]]);
        deepSet(map1, map2);

        // Check reference to mother remained equal
        expect(babyCat === babyCatChanged).toBe(false);

        // Reference to mother should be the same
        expect(babyCat.mother === cat).toBe(true);

        // Mother data should be updated
        expect(cat.name).toBe('Cat 2');
        expect(babyCat.name).toBe('Baby Cat 2');
    });

    it('Does not work recursively in maps with different keys', () => {
        const babyCat = new Cat();
        babyCat.id = '1';
        babyCat.name = 'Baby Cat';

        const cat = new Cat();
        cat.id = '2';
        cat.name = 'Cat';

        babyCat.mother = cat;

        const babyCatChanged = new Cat();
        babyCatChanged.id = '1';
        babyCatChanged.name = 'Baby Cat 2';

        const catChanged = new Cat();
        catChanged.id = '2';
        catChanged.name = 'Cat 2';

        babyCatChanged.mother = catChanged;

        // Deep set
        const map1 = new Map([['a', babyCat]]);
        const map2 = new Map([['b', babyCatChanged]]);
        deepSet(map1, map2);

        expect(map1.size).toEqual(1);
        expect(map1.has('b')).toBe(true);
        expect(map1.has('a')).toBe(false);

        // Mother data should not be updated
        expect(cat.name).toBe('Cat');
        expect(babyCat.name).toBe('Baby Cat');
    });

    it('Reuses references to arrays and updates objects', () => {
        const motherDog = new Dog();
        motherDog.id = '1';
        motherDog.name = 'Mother Dog';

        const originalArray = motherDog.children;

        const dog2 = new Dog();
        dog2.id = '2';
        dog2.name = 'Dog 2';
        motherDog.children.push(dog2);

        const dog3 = new Dog();
        dog3.id = '3';
        dog3.name = 'Dog 3';
        motherDog.children.push(dog3);

        const updatedMotherDog = new Dog();
        updatedMotherDog.id = '1';
        updatedMotherDog.name = 'Mother Dog Updated';

        const updatedDog2 = new Dog();
        updatedDog2.id = '2';
        updatedDog2.name = 'Dog 2 Updated';
        updatedMotherDog.children.push(updatedDog2);

        // Dog 3 is removed

        // New dog 4
        const updatedDog4 = new Dog();
        updatedDog4.id = '4';
        updatedDog4.name = 'Dog 4';
        updatedMotherDog.children.push(updatedDog4);

        // Deep set mother
        motherDog.deepSet(updatedMotherDog);

        // Check reference to array is deep equal
        expect(motherDog.children === originalArray).toBe(true);
        expect(motherDog.children.length).toBe(2);

        // Check dog2 is changed
        expect(motherDog.children[0] === dog2).toBe(true);
        expect(dog2.name).toBe('Dog 2 Updated');

        // Check dog4 is added
        expect(motherDog.children[1] === updatedDog4).toBe(true);
        expect(updatedDog4.name).toBe('Dog 4');
    });

    it('can handle recursive object trees', () => {
        const member1: any = {
            name: 'member one',
            users: [],
        };

        const member2: any = {
            name: 'member two',
            users: [],
        };

        const a: any = {
            id: '1',
            name: 'A',
            members: [
                member1,
                member2,
            ],
        };
        a.friends = [a];
        a.me = a;
        member1.users = [a];
        member2.users = [a];

        const b: any = {
            id: '1',
            name: 'B',
            members: [
                structuredClone(member1),
                structuredClone(member2),
            ],
        };
        b.friends = [b];
        b.me = b;

        b.members[0].users = [b];
        member2.users = [a];

        deepSet(a, b);
        expect(a.name).toEqual('B');
        expect(a.friends[0]).toBe(a);

        deepSet(a, b);
    });

    it('moves right references', () => {
        const a = { id: 'a', a: true };
        const b = { id: 'b', b: true };
        const c = { id: 'c', c: true };

        const object = {
            id: 'setter',
            a,
            b,
            c,
        };
        const newObject = {
            id: 'setter',
            a: {
                id: 'a', addA: true,
            },
            b: {
                id: 'something else',
                addB: false,
            },
            c: {
                id: 'something else',
                addC: false,
            },
        };
        deepSet(object, newObject);

        expect(a).toStrictEqual({
            id: 'a',
            a: true,
            addA: true,
        });

        // b and c are unaffected
        expect(b).toStrictEqual({
            id: 'b',
            b: true,
        });
        expect(c).toStrictEqual({
            id: 'c',
            c: true,
        });

        expect(object.b).toBe(newObject.b);
        expect(object.b).toStrictEqual({
            id: 'something else',
            addB: false,
        });
        expect(object.c).toBe(newObject.c);
        expect(object.c).toStrictEqual({
            id: 'something else',
            addC: false,
        });
    });

    describe('Arrays', () => {
        it('New items are added and existing altered', () => {
            const existingItem = { id: 'A', name: 'A' };
            const container = {
                name: 'Container',
                friends: {
                    organizations: [existingItem],
                },
            };
            const originalArray = container.friends.organizations;

            const newItem = { id: 'B', name: 'B' };
            const containerAfter = {
                name: 'Container',
                friends: {
                    organizations: [{ id: 'A', name: 'A Changed' }, newItem],
                },
            };

            const result = deepSet(container, containerAfter);
            expect(result).toBe(container);

            expect(container.friends.organizations.length).toEqual(2);
            expect(container.friends.organizations[0]).toBe(existingItem);
            expect(container.friends.organizations[1]).toBe(newItem);

            expect(existingItem.name).toEqual('A Changed');

            // Array refrence should be reused
            expect(container.friends.organizations).toBe(originalArray);
        });

        it('Missing items are removed by default while existing are still altered', () => {
            const existingItem = { id: 'A', name: 'A' };
            const newItem = { id: 'B', name: 'B' };
            const container = {
                name: 'Container',
                friends: {
                    organizations: [existingItem, newItem],
                },
            };
            const originalArray = container.friends.organizations;

            const containerAfter = {
                name: 'Container',
                friends: {
                    organizations: [{ id: 'A', name: 'A Changed' }],
                },
            };

            const result = deepSet(container, containerAfter);
            expect(result).toBe(container);

            expect(container.friends.organizations.length).toEqual(1);
            expect(container.friends.organizations[0]).toBe(existingItem);

            expect(existingItem.name).toEqual('A Changed');

            // Array refrence should be reused
            expect(container.friends.organizations).toBe(originalArray);
        });
    });
});
