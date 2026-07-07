import { spawnSync } from "child_process";

const opensslArgs = [
  "enc",
  "-seed-cbc",
  "-provider",
  "legacy",
  "-provider",
  "default",
];
const fallbackOpenSslArgs = ["enc", "-seed-cbc"];

const runOpenSslSeedCbc = (
  input: Buffer,
  key: Buffer,
  iv: Buffer,
  decrypt: boolean,
) => {
  const baseArgs = decrypt ? [...opensslArgs, "-d"] : opensslArgs;
  const args = [
    ...baseArgs,
    "-K",
    key.toString("hex"),
    "-iv",
    iv.toString("hex"),
  ];
  const result = spawnSync("openssl", args, {
    input,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status === 0) {
    return result.stdout;
  }

  const fallbackBaseArgs = decrypt
    ? [...fallbackOpenSslArgs, "-d"]
    : fallbackOpenSslArgs;
  const fallbackResult = spawnSync(
    "openssl",
    [
      ...fallbackBaseArgs,
      "-K",
      key.toString("hex"),
      "-iv",
      iv.toString("hex"),
    ],
    {
      input,
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (fallbackResult.status !== 0) {
    throw new Error(
      "OpenSSL SEED-CBC operation failed. Verify OpenSSL has SEED support enabled.",
    );
  }

  return fallbackResult.stdout;
};

export const seedCbcEncrypt = (input: Buffer, key: Buffer, iv: Buffer) =>
  runOpenSslSeedCbc(input, key, iv, false);

export const seedCbcDecrypt = (input: Buffer, key: Buffer, iv: Buffer) =>
  runOpenSslSeedCbc(input, key, iv, true);
