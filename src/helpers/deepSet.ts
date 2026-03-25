import { getOptionalId, hasId } from '../classes/Identifiable.js';
import { deepSetArray } from './deepSetArray.js';
import { deepSetMap } from './deepSetMap.js';

export function deepSet(base: unknown, object: unknown): unknown {
    if (object === base) {
        // Nothing to do (waste of resources)
        return base;
    }

    if (base === null || base === undefined || typeof base === 'string' || typeof base === 'number' || typeof base === 'boolean') {
        // Cannot update reference
        return object;
    }

    if (base instanceof Date) {
        if (object instanceof Date) {
            base.setTime(object.getTime());
            return base;
        }
        // Override
        return object;
    }

    if (object !== null && base !== null && typeof object === 'object' && typeof base === 'object') {
        if (Array.isArray(base)) {
            if (Array.isArray(object)) {
                return deepSetArray(base, object);
            }
            // Override
            return object;
        }

        if (base instanceof Map) {
            if (object instanceof Map) {
                return deepSetMap(base, object);
            }

            // todo
            return object;
        }

        // Check if base has an id
        if (hasId(base)) {
            if (getOptionalId(base) !== getOptionalId(object)) {
                // Skip copy if not the same: replace with object
                return object;
            }
        }

        for (const key in object) {
            if (Object.hasOwn(object, key) && typeof object[key] !== 'function') {
                const value = object[key];
                const baseValue = base[key];

                // Precent recursive updates
                object[key] = baseValue;
                const setValue = deepSet(baseValue, value);
                if (setValue !== baseValue) {
                    // Reference was not updated, set instead
                    base[key] = setValue;
                    object[key] = setValue;
                }
            }
        }

        return base;
    }

    // Override
    return object;
}
