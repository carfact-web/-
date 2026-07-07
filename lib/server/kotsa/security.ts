import {
  constants,
  createHash,
  createPrivateKey,
  createPublicKey,
  createSign,
  createVerify,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  X509Certificate,
} from "crypto";
import { readFile } from "fs/promises";
import {
  decodeInteger,
  decodeKotsaPackage,
  encodeKotsaPackage,
  readDerChildren,
  readDerNode,
} from "@/lib/server/kotsa/der";
import { seedCbcDecrypt, seedCbcEncrypt } from "@/lib/server/kotsa/seedCipher";

interface KotsaSecurityConfig {
  certificatePath: string;
  privateKeyPassword: string;
  privateKeyPath: string;
}

const pkcs5PasswordToBytes = (password: string) =>
  Buffer.from(password, "binary");

const pbkdf1Sha1 = (password: string, salt: Buffer, iterations: number) => {
  if (iterations < 1) {
    throw new Error("Invalid private key iteration count.");
  }

  let digest = createHash("sha1")
    .update(pkcs5PasswordToBytes(password))
    .update(salt)
    .digest();

  for (let index = 1; index < iterations; index += 1) {
    digest = createHash("sha1").update(digest).digest();
  }

  return digest;
};

const readKotsaPrivateKey = async ({
  privateKeyPassword,
  privateKeyPath,
}: KotsaSecurityConfig) => {
  const encryptedPrivateKey = await readFile(privateKeyPath);
  const root = readDerNode(encryptedPrivateKey);

  if (root.tag !== 0x30) {
    throw new Error("Invalid KOTSA private key.");
  }

  const [algorithm, encryptedData] = readDerChildren(root.value);

  if (!algorithm || !encryptedData || algorithm.tag !== 0x30) {
    throw new Error("Invalid KOTSA private key structure.");
  }

  const [, parameters] = readDerChildren(algorithm.value);

  if (!parameters || parameters.tag !== 0x30 || encryptedData.tag !== 0x04) {
    throw new Error("Invalid KOTSA private key parameters.");
  }

  const [salt, iterationCount] = readDerChildren(parameters.value);

  if (!salt || !iterationCount || salt.tag !== 0x04 || iterationCount.tag !== 0x02) {
    throw new Error("Invalid KOTSA private key KDF parameters.");
  }

  const derivedKey = pbkdf1Sha1(
    privateKeyPassword,
    salt.value,
    decodeInteger(iterationCount.value),
  );
  const seedKey = derivedKey.subarray(0, 16);
  const digestBytes = derivedKey.subarray(16, 20);
  const seedIv = createHash("sha1").update(digestBytes).digest().subarray(0, 16);
  const pkcs8Key = seedCbcDecrypt(encryptedData.value, seedKey, seedIv);

  return createPrivateKey({
    key: pkcs8Key,
    format: "der",
    type: "pkcs8",
  });
};

const readKotsaPublicKey = async ({ certificatePath }: KotsaSecurityConfig) => {
  const certificate = new X509Certificate(await readFile(certificatePath));

  return createPublicKey(certificate.publicKey);
};

const signEncryptedMessage = (privateKey: ReturnType<typeof createPrivateKey>, data: Buffer) => {
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();

  return signer.sign(privateKey);
};

const verifyEncryptedMessage = (
  publicKey: ReturnType<typeof createPublicKey>,
  data: Buffer,
  signature: Buffer,
) => {
  const verifier = createVerify("RSA-SHA256");
  verifier.update(data);
  verifier.end();

  return verifier.verify(publicKey, signature);
};

export const encryptKotsaPayload = async (
  requestJson: string,
  config: KotsaSecurityConfig,
) => {
  const publicKey = await readKotsaPublicKey(config);
  const privateKey = await readKotsaPrivateKey(config);
  const seedKey = randomBytes(16);
  const seedIv = randomBytes(16);
  const encryptedMessage = seedCbcEncrypt(
    Buffer.from(requestJson, "utf8"),
    seedKey,
    seedIv,
  );
  const signature = signEncryptedMessage(privateKey, encryptedMessage);
  const encryptedKey = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
    seedKey,
  );
  const encryptedIv = publicEncrypt(
    { key: publicKey, padding: constants.RSA_PKCS1_PADDING },
    seedIv,
  );

  return encodeKotsaPackage(
    encryptedKey,
    encryptedIv,
    signature,
    encryptedMessage,
  ).toString("base64");
};

export const decryptKotsaPayload = async (
  encryptedPayload: string,
  config: KotsaSecurityConfig,
) => {
  const publicKey = await readKotsaPublicKey(config);
  const privateKey = await readKotsaPrivateKey(config);
  const unpacked = decodeKotsaPackage(Buffer.from(encryptedPayload, "base64"));

  if (
    !verifyEncryptedMessage(
      publicKey,
      unpacked.encryptedMessage,
      unpacked.signature,
    )
  ) {
    throw new Error("KOTSA response signature verification failed.");
  }

  const seedKey = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    unpacked.encryptedKey,
  );
  const seedIv = privateDecrypt(
    { key: privateKey, padding: constants.RSA_PKCS1_PADDING },
    unpacked.encryptedIv,
  );

  return seedCbcDecrypt(unpacked.encryptedMessage, seedKey, seedIv).toString(
    "utf8",
  );
};
