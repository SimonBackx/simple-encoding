import { deepSet } from './deepSet';

export function deepSetMap(oldMap: Map<unknown, unknown>, newMap: Map<unknown, unknown>) {
    const copiedMap = new Map(oldMap);
    oldMap.clear();

    for (const [key, value] of newMap.entries()) {
        const baseValue = copiedMap.get(key);
        // Prevent recursive updates
        newMap.set(key, baseValue);
        const setValue = deepSet(baseValue, value);
        oldMap.set(key, setValue);

        if (setValue !== baseValue) {
            newMap.set(key, setValue);
        }
    }

    return oldMap;
}
