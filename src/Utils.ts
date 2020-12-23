export const assertNotNull = <T>(val: T | undefined | null, name?: string, when?: string): val is T => {
    if (val == null) {
        console.error(`${name ?? "value"} is null when ${when ?? "assert"} is called.`);
        return false;
    }
    return true;
}