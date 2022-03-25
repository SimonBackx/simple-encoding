import { Data } from "../classes/Data";
import { Decoder } from "../classes/Decoder";

class AnyDecoder implements Decoder<any> {
    decode(data: Data): any {
        return data.value;
    }
}

export default new AnyDecoder();