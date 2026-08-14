import path from "path";

export interface KotsaComprehensiveConfig {
  apiBaseUrl: string;
  apiKey: string;
  certificatePath: string;
  privateKeyPassword: string;
  privateKeyPath: string;
}

const projectRoot = process.cwd();
const publicRoot = path.join(projectRoot, "public");

const isInside = (candidate: string, parent: string) => {
  const relative = path.relative(parent, candidate);

  return Boolean(relative) && !relative.startsWith("..") && !path.isAbsolute(relative);
};

const getRequiredEnv = (key: string) => {
  const value = process.env[key]?.trim();

  if (!value) {
    throw new Error(`${key} server configuration is missing.`);
  }

  return value;
};

const assertSecretFileIsOutsideProject = (filePath: string) => {
  const resolvedPath = path.resolve(filePath);

  if (isInside(resolvedPath, projectRoot) || resolvedPath === projectRoot) {
    throw new Error("KOTSA certificate files must be stored outside the project.");
  }

  if (isInside(resolvedPath, publicRoot) || resolvedPath === publicRoot) {
    throw new Error("KOTSA certificate files must never be stored in public.");
  }
};

export const getKotsaComprehensiveConfig = (): KotsaComprehensiveConfig => {
  const certificatePath = getRequiredEnv("KOTSA_CERT_PATH");
  const privateKeyPath = getRequiredEnv("KOTSA_PRIVATE_KEY_PATH");

  assertSecretFileIsOutsideProject(certificatePath);
  assertSecretFileIsOutsideProject(privateKeyPath);

  return {
    apiBaseUrl: getRequiredEnv("KOTSA_API_BASE_URL"),
    apiKey: getRequiredEnv("KOTSA_COMPREHENSIVE_API_KEY"),
    certificatePath,
    privateKeyPassword: getRequiredEnv("KOTSA_PRIVATE_KEY_PASSWORD"),
    privateKeyPath,
  };
};
