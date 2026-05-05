import { getOptionalId, hasId } from '../classes/Identifiable.js';
import { deepSetArray } from './deepSetArray.js';
import { deepSetMap } from './deepSetMap.js';

export function deepSet(base: unknown, object: unknown, options?: { replaceOnIdChange?: boolean }): unknown {
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

            // Override
            return object;
        }

        // Check if base has an id
        // It is possible that the id of a deeper object has changed, that should not mean that the
        // object should change everywhere, so we don't set.
        // This is only required when supportReplace, since then we are updating more deeply already
        // E.g. address objects in Stamhoofd have an id getter where this causes issues.
        // E.g. you change a group property of an event, that should not mean the old group should be swapped with the new group
        if (options?.replaceOnIdChange && hasId(base)) {
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
                const setValue = deepSet(baseValue, value, { replaceOnIdChange: true });
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
