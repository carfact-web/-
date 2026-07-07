interface DerNode {
  tag: number;
  value: Buffer;
  nextOffset: number;
}

const readLength = (data: Buffer, offset: number) => {
  const first = data[offset];

  if (first === undefined) {
    throw new Error("Invalid DER length.");
  }

  if (first < 0x80) {
    return { length: first, offset: offset + 1 };
  }

  const lengthByteCount = first & 0x7f;

  if (lengthByteCount === 0 || lengthByteCount > 4) {
    throw new Error("Unsupported DER length.");
  }

  let length = 0;
  let nextOffset = offset + 1;

  for (let index = 0; index < lengthByteCount; index += 1) {
    const byte = data[nextOffset];

    if (byte === undefined) {
      throw new Error("Truncated DER length.");
    }

    length = (length << 8) | byte;
    nextOffset += 1;
  }

  return { length, offset: nextOffset };
};

export const readDerNode = (data: Buffer, offset = 0): DerNode => {
  const tag = data[offset];

  if (tag === undefined) {
    throw new Error("Missing DER tag.");
  }

  const lengthInfo = readLength(data, offset + 1);
  const valueStart = lengthInfo.offset;
  const valueEnd = valueStart + lengthInfo.length;

  if (valueEnd > data.length) {
    throw new Error("Truncated DER value.");
  }

  return {
    tag,
    value: data.subarray(valueStart, valueEnd),
    nextOffset: valueEnd,
  };
};

export const readDerChildren = (sequenceValue: Buffer) => {
  const children: DerNode[] = [];
  let offset = 0;

  while (offset < sequenceValue.length) {
    const child = readDerNode(sequenceValue, offset);
    children.push(child);
    offset = child.nextOffset;
  }

  if (offset !== sequenceValue.length) {
    throw new Error("Invalid DER sequence.");
  }

  return children;
};

const encodeLength = (length: number) => {
  if (length < 0x80) {
    return Buffer.from([length]);
  }

  const bytes: number[] = [];
  let value = length;

  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }

  return Buffer.from([0x80 | bytes.length, ...bytes]);
};

const encodeNode = (tag: number, value: Buffer) =>
  Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value]);

export const encodeOctetString = (value: Buffer) => encodeNode(0x04, value);

export const encodeSequence = (children: Buffer[]) =>
  encodeNode(0x30, Buffer.concat(children));

export const decodeInteger = (value: Buffer) => {
  let result = 0;

  for (const byte of value) {
    result = (result << 8) | byte;
  }

  return result;
};

export const decodeKotsaPackage = (data: Buffer) => {
  const sequence = readDerNode(data);

  if (sequence.tag !== 0x30 || sequence.nextOffset !== data.length) {
    throw new Error("Invalid KOTSA package.");
  }

  const children = readDerChildren(sequence.value);

  if (children.length !== 4 || children.some((child) => child.tag !== 0x04)) {
    throw new Error("Invalid KOTSA package fields.");
  }

  return {
    encryptedKey: children[0].value,
    encryptedIv: children[1].value,
    signature: children[2].value,
    encryptedMessage: children[3].value,
  };
};

export const encodeKotsaPackage = (
  encryptedKey: Buffer,
  encryptedIv: Buffer,
  signature: Buffer,
  encryptedMessage: Buffer,
) =>
  encodeSequence([
    encodeOctetString(encryptedKey),
    encodeOctetString(encryptedIv),
    encodeOctetString(signature),
    encodeOctetString(encryptedMessage),
  ]);
