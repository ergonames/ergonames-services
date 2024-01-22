export function getShortenedString(str: string, amountOnEachSide: number): string {
    let first = str.substring(0, amountOnEachSide);
    let last = str.substring(str.length - amountOnEachSide, str.length);
    return `${first}...${last}`;
}