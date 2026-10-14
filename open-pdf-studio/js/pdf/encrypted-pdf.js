// Does this PDF carry an /Encrypt entry in its trailer (or the cross-reference
// stream dictionary)? Only the head and the tail of the file are searched: the
// trailer sits at the end, or at the start of a linearized file.
const WINDOW = 16384;

export function pdfBytesHaveEncryption(bytes) {
  if (!bytes || !bytes.length) return false;
  const latin1 = (part) => new TextDecoder('latin1').decode(part);
  const tail = latin1(bytes.subarray(Math.max(0, bytes.length - WINDOW)));
  const head = bytes.length > WINDOW ? latin1(bytes.subarray(0, WINDOW)) : '';
  return /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(tail) || /\/Encrypt\s*(\d+\s+\d+\s+R|<<)/.test(head);
}
