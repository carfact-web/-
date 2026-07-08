import { spawnSync } from "node:child_process";
import {
  constants,
  createHash,
  createPrivateKey,
  createSign,
  createVerify,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  X509Certificate,
} from "node:crypto";
import { readFileSync } from "node:fs";

const maskedVehicle = "390\uC6B0****";
const linkInfoCd = "AC1_ZA90_01";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

const loadEnv = (path) => {
  const env = {};

  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");

    if (index < 0) continue;

    const key = trimmed.slice(0, index);
    let value = trimmed.slice(index + 1);

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
};

const readLength = (data, offset) => {
  const first = data[offset];

  if (first < 0x80) return { length: first, offset: offset + 1 };

  const count = first & 0x7f;
  let length = 0;
  let nextOffset = offset + 1;

  for (let index = 0; index < count; index += 1) {
    length = (length << 8) | data[nextOffset];
    nextOffset += 1;
  }

  return { length, offset: nextOffset };
};

const readNode = (data, offset = 0) => {
  const tag = data[offset];
  const lengthInfo = readLength(data, offset + 1);
  const valueStart = lengthInfo.offset;
  const valueEnd = valueStart + lengthInfo.length;

  return {
    nextOffset: valueEnd,
    tag,
    value: data.subarray(valueStart, valueEnd),
  };
};

const readChildren = (value) => {
  const children = [];
  let offset = 0;

  while (offset < value.length) {
    const child = readNode(value, offset);
    children.push(child);
    offset = child.nextOffset;
  }

  return children;
};

const encodeLength = (length) => {
  if (length < 0x80) return Buffer.from([length]);

  const bytes = [];
  let value = length;

  while (value > 0) {
    bytes.unshift(value & 0xff);
    value >>= 8;
  }

  return Buffer.from([0x80 | bytes.length, ...bytes]);
};

const encodeNode = (tag, value) =>
  Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value]);
const octet = (value) => encodeNode(0x04, value);
const sequence = (children) => encodeNode(0x30, Buffer.concat(children));

const integer = (value) => {
  let result = 0;

  for (const byte of value) {
    result = (result << 8) | byte;
  }

  return result;
};

const seedCbc = (input, key, iv, decrypt = false) => {
  const args = [
    "enc",
    "-seed-cbc",
    "-provider",
    "legacy",
    "-provider",
    "default",
    ...(decrypt ? ["-d"] : []),
    "-K",
    key.toString("hex"),
    "-iv",
    iv.toString("hex"),
  ];
  const result = spawnSync("openssl", args, { input, maxBuffer: 10 * 1024 * 1024 });

  if (result.status !== 0) {
    throw new Error("openssl seed-cbc failed");
  }

  return result.stdout;
};

const pbkdf1Sha1 = (password, salt, iterations) => {
  let digest = createHash("sha1").update(Buffer.from(password, "binary")).update(salt).digest();

  for (let index = 1; index < iterations; index += 1) {
    digest = createHash("sha1").update(digest).digest();
  }

  return digest;
};

const readPrivateKey = (path, password) => {
  const root = readNode(readFileSync(path));
  const [algorithm, encryptedData] = readChildren(root.value);
  const [, parameters] = readChildren(algorithm.value);
  const [salt, iterationCount] = readChildren(parameters.value);
  const derived = pbkdf1Sha1(password, salt.value, integer(iterationCount.value));
  const seedKey = derived.subarray(0, 16);
  const seedIv = createHash("sha1").update(derived.subarray(16, 20)).digest().subarray(0, 16);
  const pkcs8 = seedCbc(encryptedData.value, seedKey, seedIv, true);

  return createPrivateKey({ format: "der", key: pkcs8, type: "pkcs8" });
};

const derSummary = (der) => {
  const root = readNode(der);
  const children = readChildren(root.value);

  return {
    derSequenceObjectCount: children.length,
    derTags: children.map((child) => "0x" + child.tag.toString(16).padStart(2, "0")),
    derTotalLength: der.length,
    encryptedIvLength: children[1].value.length,
    encryptedKeyLength: children[0].value.length,
    seedEncryptedMessageLength: children[3].value.length,
    signedDataLength: children[2].value.length,
  };
};

const packageSummary = (json, der, base64) => ({
  base64Length: base64.length,
  plainByteLength: Buffer.byteLength(json, "utf8"),
  plainSha256: sha256(json),
  ...derSummary(der),
});

const encrypt = (json, publicKey, privateKey) => {
  const seedKey = randomBytes(16);
  const seedIv = randomBytes(16);
  const encryptedData = seedCbc(Buffer.from(json, "utf8"), seedKey, seedIv);
  const signature = createSign("RSA-SHA256").update(encryptedData).end().sign(privateKey);
  const encryptedKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
    seedKey,
  );
  const encryptedIv = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
    seedIv,
  );
  const der = sequence([
    octet(encryptedKey),
    octet(encryptedIv),
    octet(signature),
    octet(encryptedData),
  ]);

  return {
    base64: der.toString("base64"),
    der,
    encryptedData,
    packagedSignatureLength: createSign("RSA-SHA256").update(der).end().sign(privateKey).length,
    plainSignatureLength: createSign("RSA-SHA256").update(json).end().sign(privateKey).length,
    signatureTarget: "encryptedData",
  };
};

const decrypt = (base64, publicKey, privateKey) => {
  const children = readChildren(readNode(Buffer.from(base64, "base64")).value);
  const [encryptedKey, encryptedIv, signature, encryptedData] = children.map((child) => child.value);
  const verifier = createVerify("RSA-SHA256").update(encryptedData).end();

  if (!verifier.verify(publicKey, signature)) {
    throw new Error("signature verify failed");
  }

  const seedKey = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    encryptedKey,
  );
  const seedIv = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    encryptedIv,
  );

  return seedCbc(encryptedData, seedKey, seedIv, true).toString("utf8");
};

const stripBody = (body) => {
  const trimmed = body.trim();

  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const extract = (json, key) => {
  const match = new RegExp(`"${key}"\\s*:\\s*(null|"([^"]*)"|[^,}]+)`).exec(json);

  if (!match || match[1] === "null") return null;

  return match[2] ?? match[1];
};

const businessSummary = (json) => ({
  atmbNmExists: !/"atmbNm"\s*:\s*null/.test(json) && /"atmbNm"\s*:/.test(json),
  linkRsltCd: extract(json, "linkRsltCd"),
  linkRsltDtl: extract(json, "linkRsltDtl"),
  prcsImprtyRsnCd: extract(json, "prcsImprtyRsnCd"),
  prcsImprtyRsnDtls: extract(json, "prcsImprtyRsnDtls"),
  recordExists: !/"record"\s*:\s*null/.test(json) && /"record"\s*:/.test(json),
});

const call = async (endpoint, apiKey, json, publicKey, privateKey) => {
  const encrypted = encrypt(json, publicKey, privateKey);
  const startedAt = Date.now();
  const response = await fetch(endpoint, {
    body: encrypted.base64,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      cvmis_apikey: apiKey,
    },
    method: "POST",
  });
  const body = stripBody(await response.text());
  const result = {
    http: {
      accept: "application/json",
      bodyHasNewline: encrypted.base64.endsWith("\n"),
      bodyLastChar: encrypted.base64.slice(-1),
      contentLength: Buffer.byteLength(encrypted.base64, "utf8"),
      contentType: "application/json",
      headers: {
        connection: response.headers.get("connection"),
        contentLength: response.headers.get("content-length"),
        contentType: response.headers.get("content-type"),
        date: response.headers.get("date"),
        hubResult: response.headers.get("hub_result"),
        hubResultCode: response.headers.get("hub_result_code"),
        server: response.headers.get("server"),
        transactionId: response.headers.get("transaction_id"),
        transferEncoding: response.headers.get("transfer-encoding"),
      },
      host: new URL(endpoint).host,
      method: "POST",
      responseTimeMs: Date.now() - startedAt,
      status: response.status,
      url: endpoint,
    },
    request: {
      ...packageSummary(json, encrypted.der, encrypted.base64),
      packagedSignatureLength: encrypted.packagedSignatureLength,
      plainSignatureLength: encrypted.plainSignatureLength,
      signatureTarget: encrypted.signatureTarget,
    },
    responseBodyLength: Buffer.byteLength(body, "utf8"),
  };

  try {
    const decrypted = decrypt(body, publicKey, privateKey);
    result.decryptOk = true;
    result.business = businessSummary(decrypted);
  } catch (error) {
    result.decryptOk = false;
    result.decryptError = error instanceof Error ? error.message : "unknown";
  }

  return result;
};

const env = loadEnv("/root/carfact/.env.local");
const certificate = new X509Certificate(readFileSync(env.KOTSA_CERT_PATH));
const publicKey = certificate.publicKey;
const privateKey = readPrivateKey(env.KOTSA_PRIVATE_KEY_PATH, env.KOTSA_PRIVATE_KEY_PASSWORD);
const vehicleNumber = String.fromCodePoint(0x33, 0x39, 0x30, 0xc6b0, 0x36, 0x39, 0x34, 0x32);
const companyName = "\uCF00\uC774\uC5E0\uCEF4\uD37C\uB2C8";
const minimalJson = JSON.stringify({ data: [{ linkInfoCd, vhclNo: vehicleNumber }] });
const fullJson = JSON.stringify({
  data: [
    {
      linkInfoCd,
      picId: "ZA90",
      picNm: companyName,
      picIpAddr: "95.217.167.210",
      vhclNo: vehicleNumber,
    },
  ],
});
const roundTripKey = randomBytes(16);
const roundTripIv = randomBytes(16);
const roundTripPlain = Buffer.from(minimalJson, "utf8");
const roundTripEncrypted = seedCbc(roundTripPlain, roundTripKey, roundTripIv);
const roundTripDecrypted = seedCbc(roundTripEncrypted, roundTripKey, roundTripIv, true);

console.log(
  JSON.stringify(
    {
      maskedVehicle,
      nodeVersion: process.version,
      opensslVersion: process.versions.openssl,
      plainUtf8: {
        bom: false,
        byteLength: Buffer.byteLength(minimalJson, "utf8"),
        sha256: sha256(minimalJson),
        vehicleByteLength: Buffer.byteLength(vehicleNumber, "utf8"),
        vehicleStringLength: [...vehicleNumber].length,
      },
      seedRoundTripOk: roundTripPlain.equals(roundTripDecrypted),
      minimal: await call(env.KOTSA_API_BASE_URL, env.KOTSA_API_KEY, minimalJson, publicKey, privateKey),
      full: await call(env.KOTSA_API_BASE_URL, env.KOTSA_API_KEY, fullJson, publicKey, privateKey),
      stagingMinimal: await call(
        "https://linkstg.car365.go.kr/hub/kotsa",
        env.KOTSA_API_KEY,
        minimalJson,
        publicKey,
        privateKey,
      ),
    },
    null,
    2,
  ),
);
