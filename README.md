# Simple encoding

This small library has no dependencies and adds interfaces and classes that you can use to encode and decode your own classes to a JSON compatible structure. Can get used for storage, APIs,

Encoding and decoding can get customized, and that's the whole point of this library. You'll need to write some minor boilerplate code, but that will allow you to customize and work fast.

## Features

-   Great errors out of the box
-   Customize as you which:
    -   By not using automatic generation of the encoded format, you can easily let the field names and types differ between the encoded version and your actual instances.
    -   You can add your own decoders/validators for custom fields (e.g. phone number)
-   Minor and readable boilerplate code

## Todo

-   [ ] Add context to Data: Allows for versioning (e.g. you can store a verion in the context and let the encoding/decoding differ between each version). In fact you could add this yourself by implementing Data.
-   [ ] Add some more basic types

## Usage example

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
const json = JSON.stringify(test2.encode());

// ... Store or send the JSON somewhere

// Decode from JSON
const plainObject = JSON.parse(json);
const data = new ObjectData(plainObject);
const instance = MyClass.decode(data);
// Decode throws if fields are missing or types are not okay.
// You can use the errors to provide good errors in you API's that help developers to
// point out the missing fields or types.

// Now all methods are available again
instance.writeName();
```
