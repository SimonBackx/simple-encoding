import { getOptionalId } from '../classes/Identifiable.js';
import { deepSet } from './deepSet.js';

export function deepSetArray(oldArray: any[], newArray: any[], options?: { keepMissing?: boolean }) {
    if (oldArray === newArray) {
        // Same reference: nothing to do
        return oldArray;
    }

    const copiedArray = (oldArray as any[]).slice();

    // Loop old array
    // Keep array reference
    // Delete deleted items
    // Add new items
    // Copy over changes from updated items
    // Maintain new order

    // Clear out old array
    oldArray.splice(0, oldArray.length);

    for (const newItem of newArray) {
        if (newItem && typeof newItem === 'object' && !Array.isArray(newItem)) {
            const oldItem = copiedArray.find(i => getOptionalId(i) === getOptionalId(newItem));
            if (oldItem !== undefined) {
                oldArray.push(deepSet(oldItem, newItem));
            }
            else {
                oldArray.push(newItem);
            }
        }
        else {
            oldArray.push(newItem);
        }
    }

    if (options?.keepMissing) {
        // Readd old missing items
        for (const oldItem of copiedArray) {
            const found = oldArray.find(i => getOptionalId(i) === getOptionalId(oldItem));

            if (!found) {
                oldArray.push(oldItem);
            }
        }
    }

    return oldArray;
}
