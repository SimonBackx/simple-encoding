import { field } from '../decorators/Field.js';
import { ArrayDecoder } from '../structs/ArrayDecoder.js';
import { MapDecoder } from '../structs/MapDecoder.js';
import StringDecoder from '../structs/StringDecoder.js';
import { AutoEncoder } from './AutoEncoder.js';
import { EncodeMedium } from './EncodeContext.js';
import { ObjectData } from './ObjectData.js';

describe('Default values', () => {
    test('Arrays are initialized as empty', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: new ArrayDecoder(StringDecoder) })
            items: string[];
        }

        expect(Dog.create({}).items).toEqual([]);
    });

    test('Arrays of AutoEncoder are initialized as empty', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: new ArrayDecoder(Dog) })
            items: Dog[];
        }

        expect(Dog.create({}).items).toEqual([]);
    });

    test('When decoding AutoEncoder the default version corresponding to the decoded version is used', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => 'v1', version: 1 })
            @field({ decoder: StringDecoder, defaultValue: () => 'v2', version: 2 })
            name: string;
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('v1');

        expect(
            Dog.decode(
                new ObjectData({}, { version: 2 }),
            ).name,
        ).toEqual('v2');

        expect(Dog.create({}).name).toEqual('v2');
    });

    test('New properties upgrade to the constructor default when missing', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, version: 2 })
            name: string = 'v2';
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('v2');

        expect(Dog.create({}).name).toEqual('v2');
    });

    test('New properties upgrade to the defaultValue when missing', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => 'v2', version: 2 })
            name: string;
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('v2');

        expect(Dog.create({}).name).toEqual('v2');
    });

    test('New properties upgrade to the oldest defaultValue when missing', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => 'v2', version: 2 })
            @field({ decoder: StringDecoder, defaultValue: () => 'v3', version: 3 })
            name: string;
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('v2');

        expect(Dog.create({}).name).toEqual('v3');
    });

    test('New properties upgrade to the oldest defaultValue when missing and constructor defaults set', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => 'v2', version: 2 })
            @field({ decoder: StringDecoder, defaultValue: () => 'v3', version: 3 })
            name: string = 'should be ignored';
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('v2');

        expect(Dog.create({}).name).toEqual('v3');
    });

    test('New properties upgrade to the first defaultValue and later upgrade when missing', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => 'v2', version: 2 })
            @field({ decoder: StringDecoder, defaultValue: () => 'v3', version: 3, upgrade(old) {
                return 'old-' + old;
            } })
            name: string;
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('old-v2');

        expect(Dog.create({}).name).toEqual('v3');
    });

    test('New properties upgrade to the first defaultValue and later upgrade when missing and constructor default set', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => 'v2', version: 2 })
            @field({ decoder: StringDecoder, defaultValue: () => 'v3', version: 3, upgrade(old) {
                return 'old-' + old;
            } })
            name: string = 'should be ignored';
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('old-v2');

        expect(Dog.create({}).name).toEqual('v3');
    });

    test('Upgrades on first version returns old value of undefined', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => 'v3', version: 3, upgrade(old) {
                return old === undefined ? 'undefined' : 'set';
            } })
            name: string;
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('undefined');

        expect(Dog.create({}).name).toEqual('v3');
    });

    test('Upgrades on first version returns old value of undefined even when constructor defaults are set', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => 'v3', version: 3, upgrade(old) {
                return old === undefined ? 'undefined' : 'set-' + old;
            } })
            name: string = 'Hello';
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('undefined');

        expect(Dog.create({}).name).toEqual('v3');
    });

    test('Class defined default values only count for the latest versions', () => {
        class Dog extends AutoEncoder {
            @field({ decoder: StringDecoder, defaultValue: () => 'v0', version: 0 }) // StringDecoder default value = ""
            @field({ decoder: StringDecoder, defaultValue: () => 'v1', version: 1 }) // v1 as default value
            @field({ decoder: StringDecoder, defaultValue: () => 'v2', version: 2 }) // v2 as default value
            @field({ decoder: StringDecoder, defaultValue: () => 'v3', version: 3 }) // v2 as default value
            name: string = 'unused';
        }

        expect(
            Dog.decode(
                new ObjectData({}, { version: 0 }),
            ).name,
        ).toEqual('v0');

        expect(
            Dog.decode(
                new ObjectData({}, { version: 1 }),
            ).name,
        ).toEqual('v1');

        expect(
            Dog.decode(
                new ObjectData({}, { version: 2 }),
            ).name,
        ).toEqual('v2');

        expect(
            Dog.decode(
                new ObjectData({}, { version: 3 }),
            ).name,
        ).toEqual('v3');

        expect(Dog.create({}).name).toEqual('v3');
    });

    test('Setting defaultValue requires you to set it for every version', () => {
        expect(() => {
            class _ extends AutoEncoder {
                @field({ decoder: StringDecoder, version: 0 }) // StringDecoder default value = ""
                @field({ decoder: StringDecoder, defaultValue: () => 'v1', version: 1 }) // v1 as default value
                @field({ decoder: StringDecoder, version: 2 }) // v2 as default value
                @field({ decoder: StringDecoder, version: 3 }) // v2 as default value
                name: string = 'v2';
            }
        }).toThrow('When you define defaultValue for at least one version of a property, you need to set if for each version. For property: name');
    });

    describe('Upgrading default values', () => {
        it('Nullable older version defaults to null when upgrading', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: StringDecoder, nullable: true })
                @field({ decoder: StringDecoder, version: 1, upgrade: v => v === null ? 'null' : '' })
                name: string;
            }

            const dog = Dog.create({});
            expect(dog.name).toEqual('');
            const encoded = dog.encode({ version: 1 });
            expect(encoded).toStrictEqual({});

            const decoded = Dog.decode(
                new ObjectData(encoded, { version: 1 }),
            );

            expect(decoded.name).toEqual('');

            const decodedAsVersion0 = Dog.decode(
                new ObjectData(encoded, { version: 0 }),
            );

            expect(decodedAsVersion0.name).toEqual('null');
        });

        it('older version defaults to defaultValue when upgrading', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: StringDecoder, nullable: true, defaultValue: () => 'Old version' })
                @field({ decoder: StringDecoder, version: 1, upgrade: v => v === null ? 'null' : v, defaultValue: () => 'New version', isDefaultValue: v => v === 'New version' })
                name: string;
            }

            const dog = Dog.create({});
            expect(dog.name).toEqual('New version');
            const encoded = dog.encode({ version: 1 });
            expect(encoded).toStrictEqual({});

            const decoded = Dog.decode(
                new ObjectData(encoded, { version: 1 }),
            );

            expect(decoded.name).toEqual('New version');

            const decodedAsVersion0 = Dog.decode(
                new ObjectData(encoded, { version: 0 }),
            );

            expect(decodedAsVersion0.name).toEqual('Old version');
        });
    });

    describe('Encoding', () => {
        it('Does encode empty strings when a default value is set', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: StringDecoder, defaultValue: () => 'Old version' })
                name: string;
            }

            {
                const dog = Dog.create({});
                expect(dog.name).toEqual('Old version');
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({
                    name: 'Old version',
                });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual('Old version');
            }

            {
                const dog = Dog.create({
                    name: '',
                });
                expect(dog.name).toEqual('');
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({
                    name: '',
                });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual('');
            }
        });

        it('Does encode empty strings for optional fields', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: StringDecoder, optional: true })
                name: string;
            }

            {
                const dog = Dog.create({});
                expect(dog.name).toEqual(undefined);
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({});

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual(undefined);
            }

            {
                const dog = Dog.create({
                    name: '',
                });
                expect(dog.name).toEqual('');
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({
                    name: '',
                });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual('');
            }
        });

        it('Does encode default values for older versions', () => {
            AutoEncoder.skipDefaultValuesVersion = 1;
            class Dog extends AutoEncoder {
                @field({ decoder: StringDecoder })
                name: string;
            }

            {
                const dog = Dog.create({});
                expect(dog.name).toEqual('');
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({});

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual('');
            }

            {
                const dog = Dog.create({});
                expect(dog.name).toEqual('');
                const encoded = dog.encode({ version: 0 });
                expect(encoded).toStrictEqual({ name: '' });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 0 }),
                );

                expect(decoded.name).toEqual('');
            }

            AutoEncoder.skipDefaultValuesVersion = 0;
        });

        it('Does encode constructor default strings for optional fields', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: StringDecoder, optional: true })
                name: string = 'Hello world';
            }

            {
                const dog = Dog.create({});
                expect(dog.name).toEqual('Hello world');
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({ });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual('Hello world');
            }

            {
                // This is legacy behaviour
                const decoded = Dog.decode(
                    new ObjectData({}, { version: 1 }),
                );

                expect(decoded.name).toEqual('Hello world');
            }

            {
                const dog = Dog.create({
                    name: '',
                });
                expect(dog.name).toEqual('');
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({
                    name: '',
                });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual('');
            }
        });

        it('Does encode empty strings for nullable string fields', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: StringDecoder, nullable: true })
                name: string | null;
            }

            {
                const dog = Dog.create({});
                expect(dog.name).toEqual(null);
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({});

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual(null);
            }

            {
                const dog = Dog.create({
                    name: '',
                });
                expect(dog.name).toEqual('');
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({
                    name: '',
                });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual('');
            }
        });

        it('Does encode empty arrays for nullable array fields', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder), nullable: true })
                name: string[] | null;
            }

            {
                const dog = Dog.create({});
                expect(dog.name).toEqual(null);
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({});

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual(null);
            }

            {
                const dog = Dog.create({
                    name: ['test'],
                });
                expect(dog.name).toEqual(['test']);
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({
                    name: ['test'],
                });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual(['test']);
            }

            {
                const dog = Dog.create({
                    name: [],
                });
                expect(dog.name).toEqual([]);
                const encoded = dog.encode({ version: 1 });
                expect(encoded).toStrictEqual({
                    name: [],
                });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 1 }),
                );

                expect(decoded.name).toEqual([]);
            }
        });

        it('Does not encode default constructor string values', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: StringDecoder })
                name = 'dog';
            }

            const dog = Dog.create({});
            expect(dog.name).toEqual('dog');
            const encoded = dog.encode({ version: 0 });
            expect(encoded).toStrictEqual({});

            const decoded = Dog.decode(
                new ObjectData(encoded, { version: 0 }),
            );

            expect(decoded.name).toEqual('dog');
        });

        it('Does encode default constructor string values when queryable', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: StringDecoder, queryable: true })
                name = 'dog';
            }

            {
                const dog = Dog.create({});
                expect(dog.name).toEqual('dog');
                const encoded = dog.encode({ version: 0, medium: EncodeMedium.Database });
                expect(encoded).toStrictEqual({
                    name: 'dog',
                });

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 0, medium: EncodeMedium.Database }),
                );

                expect(decoded.name).toEqual('dog');
            }

            {
                const dog = Dog.create({});
                expect(dog.name).toEqual('dog');
                const encoded = dog.encode({ version: 0 });
                expect(encoded).toStrictEqual({});

                const decoded = Dog.decode(
                    new ObjectData(encoded, { version: 0 }),
                );

                expect(decoded.name).toEqual('dog');
            }
        });

        it('Does not encode default empty arrays via constructor', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: new ArrayDecoder(StringDecoder) })
                names = [];
            }

            const dog = Dog.create({});
            expect(dog.names).toEqual([]);
            const encoded = dog.encode({ version: 0 });
            expect(encoded).toStrictEqual({});

            const decoded = Dog.decode(
                new ObjectData(encoded, { version: 0 }),
            );

            expect(decoded.names).toEqual([]);
        });

        it('Does not encode default empty maps via constructor', () => {
            class Dog extends AutoEncoder {
                @field({ decoder: new MapDecoder(StringDecoder, StringDecoder) })
                names = new Map();
            }

            const dog = Dog.create({});
            expect(dog.names).toEqual(new Map());
            const encoded = dog.encode({ version: 0 });
            expect(encoded).toStrictEqual({});

            const decoded = Dog.decode(
                new ObjectData(encoded, { version: 0 }),
            );

            expect(decoded.names).toBeInstanceOf(Map);
            expect(decoded.names.size).toEqual(0);
        });

        it('Does not encode default autoencode values via constructor', () => {
            class Friend extends AutoEncoder {
                @field({ decoder: StringDecoder })
                name: string;
            }

            class Dog extends AutoEncoder {
                @field({ decoder: Friend })
                friend = Friend.create({ name: 'Luc' });
            }

            const dog = Dog.create({});
            expect(dog.friend.name).toEqual('Luc');
            const encoded = dog.encode({ version: 0 });
            expect(encoded).toStrictEqual({});

            const decoded = Dog.decode(
                new ObjectData(encoded, { version: 0 }),
            );

            expect(decoded.friend.name).toEqual('Luc');
        });

        it('Does encode changed default autoencode value via constructor', () => {
            class Friend extends AutoEncoder {
                @field({ decoder: StringDecoder })
                name: string;
            }

            class Dog extends AutoEncoder {
                @field({ decoder: Friend })
                friend = Friend.create({ name: 'Luc' });
            }

            const dog = Dog.create({});
            expect(dog.friend.name).toEqual('Luc');
            dog.friend.name = 'Changed';
            const encoded = dog.encode({ version: 0 });
            expect(encoded).toStrictEqual({
                friend: {
                    name: 'Changed',
                },
            });

            const decoded = Dog.decode(
                new ObjectData(encoded, { version: 0 }),
            );

            expect(decoded.friend.name).toEqual('Changed');
        });

        it('Does encode default of default autoencoder value via constructor', () => {
            class Friend extends AutoEncoder {
                @field({ decoder: StringDecoder })
                name: string = 'Luc';
            }

            class Dog extends AutoEncoder {
                @field({ decoder: Friend })
                friend: Friend;
            }

            const dog = Dog.create({});
            expect(dog.friend.name).toEqual('Luc');
            const encoded = dog.encode({ version: 0 });
            expect(encoded).toStrictEqual({});

            const decoded = Dog.decode(
                new ObjectData(encoded, { version: 0 }),
            );

            expect(decoded.friend.name).toEqual('Luc');
        });

        it('Does not encode default autoencode values via Field.defaultValue', () => {
            class Friend extends AutoEncoder {
                @field({ decoder: StringDecoder })
                name: string;
            }

            class Dog extends AutoEncoder {
                @field({ decoder: Friend, defaultValue: () => Friend.create({ name: 'Luc' }), isDefaultValue: (value) => {
                    return value instanceof Friend && value.name === 'Luc';
                } })
                friend: Friend;
            }

            const dog = Dog.create({});
            expect(dog.friend.name).toEqual('Luc');
            const encoded = dog.encode({ version: 0 });
            expect(encoded).toStrictEqual({});

            const decoded = Dog.decode(
                new ObjectData(encoded, { version: 0 }),
            );

            expect(decoded.friend.name).toEqual('Luc');
        });
    });
});
