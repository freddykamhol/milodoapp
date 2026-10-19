const byteMap = new Map<string, number>();
const legacyDecoder = new TextDecoder("windows-1252");
for (let byte = 0; byte < 256; byte++) { byteMap.set(String.fromCharCode(byte), byte); byteMap.set(legacyDecoder.decode(Uint8Array.of(byte)), byte); }
const cp1252 = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
[...cp1252].forEach((char,index)=>byteMap.set(char,0x80+index));
const utf8 = new TextDecoder("utf-8", { fatal: true });
/** Repair only complete UTF-8 byte sequences that were decoded as Windows-1252. */
export function displayText<T extends string | number | null | undefined>(value: T): T {
  if (typeof value !== "string") return value;
  let text: string = value;
  for (let round = 0; round < 4; round++) {
    let result = "", changes = 0;
    for (let i = 0; i < text.length; i++) {
      const first = byteMap.get(text[i]) ?? 0;
      const size = first >= 0xc2 && first <= 0xdf ? 2 : first >= 0xe0 && first <= 0xef ? 3 : first >= 0xf0 && first <= 0xf4 ? 4 : 0;
      if (size) {
        const chars = text.slice(i, i + size), bytes = [...chars].map(char => byteMap.get(char));
        if (bytes.length === size && bytes.slice(1).every(byte => byte !== undefined && byte >= 0x80 && byte <= 0xbf)) {
          try { const decoded = utf8.decode(Uint8Array.from(bytes as number[])); if (decoded !== chars) { result += decoded; i += size - 1; changes++; continue; } } catch {}
        }
      }
      result += text[i];
    }
    text = result; if (!changes) break;
  }
  return text as T;
}
