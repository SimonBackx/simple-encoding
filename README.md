# Simple encoding

This small library has no dependencies and adds interfaces and classes that you can use to encode and decode your own classes to a JSON compatible structure. This enables you to build powerful API's and storage that can automigrate to newer versions on the fly.

Encoding and decoding can get customized, and that's the whole point of this library. You'll need to write some minor boilerplate code, but that will allow you to customize and work fast. You can also use the decorators and write almost no boilerplate code.

## Installation

### Yarn

```
yarn add @simonbackx/simple-encoding
```

### NPM

```
npm install @simonbackx/simple-encoding
```

## Features

-   Great errors out of the box
-   Customize as you which:
    -   By not using automatic generation of the encoded format, you can easily let the field names and types differ between the encoded version and your actual instances.
    -   You can add your own decoders/validators for custom fields (e.g. phone number)
-   Minor and readable boilerplate code

## Todo

-   [x] Add context to Data: Allows for versioning (e.g. you can store a verion in the context and let the encoding/decoding differ between each version). In fact you could add this yourself by implementing Data.
-   [ ] Add some more basic types
-   [ ] Documentation on patchable types (allows you to build powerful patch behaviour for API's)

## Usage example

### Decorators

The shortest version you can have, with experimental TypeScript decorators.

```ts
import { Encodeable, StringDecoder, NumberDecoder, field } from "@simonbackx/simple-encoding";

class MyClass extends AutoEncoder {
    @field({ decoder: NumberDecoder })
    id: number;

    @field({ decoder: StringDecoder })
    name: string;

    @field({ decoder: MyClass, optional: true })
    other?: MyClass;

    writeName() {
        console.log(this.name);
    }
}

const test = MyClass.create({ id: 123, name: "Hello world" });
const test2 = MyClass.create({ id: 123, name: "Hello world", other: test });

// Simulate a network or file storage by converting to JSON
// You can also convert it to a different storage type
const json = JSON.stringify(test2.encode({ version: 1 }));

// ... Store or send the JSON somewhere

// Decode from JSON
const plainObject = JSON.parse(json);
const data = new ObjectData(plainObject, { version: 1 });
const instance = MyClass.decode(data);
// Decode throws if fields are missing or types are not okay.
// You can use the errors to provide good errors in you API's that help developers to
// point out the missing fields or types.

// Now all methods are available again
instance.writeName();
```

Now, say we want to change the type of id to a string and we want to have an extra field called createdAt. We can use versioning for this:

```ts
class MyClass extends AutoEncoder {
    @field({ decoder: NumberDecoder })
    @field({ decoder: StringDecoder, version: 2, upgrade: (old: number) => old.toString(), downgrade: (n: string) => parseInt(n) })
    id: number;

    @field({ decoder: StringDecoder }) // not specifying the version equals version 0
    name: string;

    @field({ decoder: MyClass, optional: true })
    other?: MyClass;

    @field({ decoder: DateDecoder, version: 2, upgrade: () => new Date() })
    createdAt: Date;

    writeName() {
        console.log(this.name);
    }
}
```

You must update your 'create' methods everywhere, but the encoding and decoding in the older versions keep working:

```ts
// This code ran before version 2 (with the current changes this would throw an error since createdAt is missing)
const myClass = MyClass.create({ id: 123, name: "Hello world" });
const json = JSON.stringify(myClass.encode({ version: 1 }));

// The JSON is stored here for some time on a storage medium (e.g. in a file), during which we release version 2 and need to decode the data again.

// This code ran after making the version changes
const plainObject = JSON.parse(json);
const data = new ObjectData(plainObject, { version: 1 }); // note: createdAt is determined via the upgrade method = the current date
const instance = MyClass.decode(data);

// We can use our latest methods and functions that require createdAt
```

The versions in encode an decode should always match. You'll need to store the version depending on the usage. E.g. in an API you'll need to send the version in the URL or in a separate header. In your database you can add an extra field 'version' to save the latest version you used for encoding, same for localstorage, disk storage...

The versioning system allows your API to update the backend before updating the frontend, because the newer version will always be able to communicate with older versions.

```ts
const myClass = MyClass.create({ id: "123", name: "This example keeps all data", createdAt: new Date() });
const json = JSON.stringify(myClass.encode({ version: 2 }));
const plainObject = JSON.parse(json);
const data = new ObjectData(plainObject, { version: 2 });
const instance = MyClass.decode(data);
```

### Vanilla (without decorators)

This version makes it possible to do more customization, at the cost of more boilerplate code. This is very usefull when building custom encoders and decoders that have complex behaviour.

```ts
import { Encodeable, Data, ObjectData } from "@simonbackx/simple-encoding";

class MyClass implements Encodeable {
    id: number;
    name: string;
    other?: MyClass;

    constructor(data: { id: number; name: string; other?: MyClass }) {
        this.id = data.id;
        this.name = data.name;
        this.other = data?.other;
    }

    writeName() {
        console.log(this.name);
    }

    /**
     * Note that the static MyClass implements Decoder.
     * -> static inheritance is not supported in TypeScript
     */
    static decode(data: Data): MyClass {
        // You can read data.context.version to change decoding behaviour depending on the version
        return new MyClass({
            // 'walk' the data you receive
            // data.field('fieldname') returns a new Data and throws if the field does not exist
            // The returned Data object can get decoded with a Decoder using .decode(Decoder)
            // or with a convenience getter: number, string
            id: data.field("id").number,
            name: data.field("name").string,
            other: data.optionalField("other")?.decode(MyClass),
        });
    }

    encode(context) {
        // You can read context.version to change encoding behaviour depending on the version.
        return {
            id: this.id,
            name: this.name,
            other: this.other?.encode(context),
        };
    }
}

const test = new MyClass({ id: 123, name: "Hello world" });
const test2 = new MyClass({ id: 123, name: "Hello world", other: test });

// Simulate a network or file storage by converting to JSON
// You can also convert it to a different storage type
const json = JSON.stringify(test2.encode({ version: 1 }));

// ... Store or send the JSON somewhere

// Decode from JSON
const plainObject = JSON.parse(json);
const data = new ObjectData(plainObject, { version: 1 });
const instance = MyClass.decode(data);
// Decode throws if fields are missing or types are not okay.
// You can use the errors to provide good errors in you API's that help developers to
// point out the missing fields or types.

// Now all methods are available again
instance.writeName();
```
