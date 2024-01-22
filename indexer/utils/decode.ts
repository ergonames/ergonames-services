export function decodeFromBase16Register(input: string): string {
    let removedPrefix = input.slice(2);
    let decoded = Buffer.from(removedPrefix, 'hex').toString('utf8');
    decoded = decoded.replace("\u0004", "");
    return decoded;
}