import { AutoEncoder } from "../classes/AutoEncoder";
import { ObjectData } from "../classes/ObjectData";
import { field } from "../decorators/Field";
import { MapDecoder } from "./MapDecoder";
import StringDecoder from "./StringDecoder";

class Cat extends AutoEncoder {
    @field({decoder: StringDecoder})
    color = ''

    @field({decoder: StringDecoder})
    name = ''
}

class Dog extends AutoEncoder {
    @field({decoder: StringDecoder})
    id = ''

    @field({decoder: new MapDecoder(StringDecoder, Cat) })
    friends = new Map<string, Cat>()
}

describe('MapDecoder', () => {
    test('it can patch map items', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1'
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2'
        });

        const dog = Dog.create({
            id: '123',
        })
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({})
        patch.friends.set('best', Cat.patch({
            color: 'green'
        }))

        const patchedDog = dog.patch(patch);

        expect(patchedDog.friends.get('best')!.color).toEqual('green');
        expect(patchedDog.friends.get('best')!.name).toEqual('Cat1');
        expect(patchedDog.friends.get('second')).toEqual(cat2)

        // did not alter original
        expect(dog.friends.get('best')!.color).toEqual('gray');
        expect(dog.friends.get('best')!.name).toEqual('Cat1');
        expect(cat1.color).toEqual('gray');
        expect(cat1.name).toEqual('Cat1');

        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(patch.encode({version: 0})))
        const decoded = Dog.patchType().decode(new ObjectData(encoded, {version: 0}))

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);

        expect(patchedDog2.friends.get('best')!.color).toEqual('green');
        expect(patchedDog2.friends.get('best')!.name).toEqual('Cat1');
        expect(patchedDog2.friends.get('second')).toEqual(cat2)

    });

    test('it can set map items', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1'
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2'
        });

        const dog = Dog.create({
            id: '123',
        })
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({})
        patch.friends.set('best', Cat.create({
            name: 'Green cat',
            color: 'green'
        }))

        const patchedDog = dog.patch(patch);

        expect(patchedDog.friends.get('best')!.color).toEqual('green');
        expect(patchedDog.friends.get('best')!.name).toEqual('Green cat');
        expect(patchedDog.friends.get('second')).toEqual(cat2)

        // did not alter original
        expect(dog.friends.get('best')!.color).toEqual('gray');
        expect(dog.friends.get('best')!.name).toEqual('Cat1');
        expect(cat1.color).toEqual('gray');
        expect(cat1.name).toEqual('Cat1');

         // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(patch.encode({version: 0})))
        const decoded = Dog.patchType().decode(new ObjectData(encoded, {version: 0}))

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);

        expect(patchedDog2.friends.get('best')!.color).toEqual('green');
        expect(patchedDog2.friends.get('best')!.name).toEqual('Green cat');
        expect(patchedDog2.friends.get('second')).toEqual(cat2)

    });

    test('it can delete map items', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1'
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2'
        });

        const dog = Dog.create({
            id: '123',
        })
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({})
        patch.friends.set('best', null)

        const patchedDog = dog.patch(patch);

        expect(patchedDog.friends.has('best')).toBe(false);
        expect(patchedDog.friends.get('second')).toEqual(cat2)

        // did not alter original
        expect(dog.friends.get('best')!.color).toEqual('gray');
        expect(dog.friends.get('best')!.name).toEqual('Cat1');
        expect(cat1.color).toEqual('gray');
        expect(cat1.name).toEqual('Cat1');

         // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(patch.encode({version: 0})))
        const decoded = Dog.patchType().decode(new ObjectData(encoded, {version: 0}))

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);

        expect(patchedDog2.friends.has('best')).toBe(false);
        expect(patchedDog2.friends.get('second')).toEqual(cat2)


    });

    test('it can override a map', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1'
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2'
        });

        const dog = Dog.create({
            id: '123',
        })
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({
            friends: new Map() as any
        })

        const patchedDog = dog.patch(patch);

        expect(patchedDog.friends.size).toBe(0);

        // did not alter original
        expect(dog.friends.get('best')!.color).toEqual('gray');
        expect(dog.friends.get('best')!.name).toEqual('Cat1');
        expect(cat1.color).toEqual('gray');
        expect(cat1.name).toEqual('Cat1');

         // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(patch.encode({version: 0})))
        const decoded = Dog.patchType().decode(new ObjectData(encoded, {version: 0}))

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);

         expect(patchedDog2.friends.size).toBe(0);
    });

    test('it can stack multiple patches', () => {
        const cat1 = Cat.create({
            color: 'gray',
            name: 'Cat1'
        });

        const cat2 = Cat.create({
            color: 'red',
            name: 'Cat2'
        });

        const dog = Dog.create({
            id: '123',
        })
        dog.friends.set('best', cat1);
        dog.friends.set('second', cat2);

        const patch = Dog.patch({})
        patch.friends.set('best', Cat.patch({color: 'c'}))
        patch.friends.set('second', null)

        const patch2 = Dog.patch({})
        patch2.friends.set('best', Cat.patch({name: 'n'}))
        patch2.friends.set('second', Cat.patch({name: 'late'}))

        const combinedPatch = patch.patch(patch2)
        expect(combinedPatch.friends.get('best')!.name).toEqual('n')
        expect(combinedPatch.friends.get('best')!.color).toEqual('c')
        expect(combinedPatch.friends.get('second')).toBe(null)

        const patch3 = Dog.patch({})
        patch3.friends.set('second', Cat.create({name: 'new'}))

        const combinedPatch2 = combinedPatch.patch(patch3)
        expect(combinedPatch2.friends.get('second')).toEqual(Cat.create({name: 'new'}))

        const patchedDog = dog.patch(combinedPatch);

        expect(patchedDog.friends.get('best')!.name).toEqual('n')
        expect(patchedDog.friends.get('best')!.color).toEqual('c')
        
        // Can do the same with decoded form
        const encoded = JSON.parse(JSON.stringify(combinedPatch.encode({version: 0})))
        const decoded = Dog.patchType().decode(new ObjectData(encoded, {version: 0}))

        const patchedDog2 = dog.patch(decoded);
        expect(patchedDog).toEqual(patchedDog2);

    });
});