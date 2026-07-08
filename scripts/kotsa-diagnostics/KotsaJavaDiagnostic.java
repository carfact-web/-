import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.KeyFactory;
import java.security.MessageDigest;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.SecureRandom;
import java.security.Security;
import java.security.Signature;
import java.security.cert.CertificateFactory;
import java.security.cert.X509Certificate;
import java.security.spec.PKCS8EncodedKeySpec;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.bouncycastle.jce.provider.BouncyCastleProvider;

public class KotsaJavaDiagnostic {
  static class DerNode {
    int tag;
    byte[] value;
    int next;

    DerNode(int tag, byte[] value, int next) {
      this.tag = tag;
      this.value = value;
      this.next = next;
    }
  }

  static class DerLength {
    int length;
    int next;

    DerLength(int length, int next) {
      this.length = length;
      this.next = next;
    }
  }

  static class PackageParts {
    byte[] der;
    byte[] encryptedData;
    byte[] encryptedIv;
    byte[] encryptedKey;
    byte[] signedData;
  }

  static final String LINK_INFO_CD = "AC1_ZA90_01";
  static final String MASKED_VEHICLE = "390\uC6B0****";

  public static void main(String[] args) throws Exception {
    Security.addProvider(new BouncyCastleProvider());

    Map<String, String> env = loadEnv(Path.of("/root/carfact/.env.local"));
    String endpoint = env.get("KOTSA_API_BASE_URL");
    String apiKey = env.get("KOTSA_API_KEY");
    String certificatePath = env.get("KOTSA_CERT_PATH");
    String privateKeyPath = env.get("KOTSA_PRIVATE_KEY_PATH");
    String privateKeyPassword = env.get("KOTSA_PRIVATE_KEY_PASSWORD");
    String vehicleNumber =
      new String(new int[] { 0x33, 0x39, 0x30, 0xC6B0, 0x36, 0x39, 0x34, 0x32 }, 0, 8);
    String companyName = "\uCF00\uC774\uC5E0\uCEF4\uD37C\uB2C8";
    String minimalJson =
      "{\"data\":[{\"linkInfoCd\":\"" + LINK_INFO_CD + "\",\"vhclNo\":\"" + vehicleNumber + "\"}]}";
    String fullJson =
      "{\"data\":[{\"linkInfoCd\":\"" +
      LINK_INFO_CD +
      "\",\"picId\":\"ZA90\",\"picNm\":\"" +
      companyName +
      "\",\"picIpAddr\":\"95.217.167.210\",\"vhclNo\":\"" +
      vehicleNumber +
      "\"}]}";

    X509Certificate certificate = readCertificate(certificatePath);
    PrivateKey privateKey = readPrivateKey(privateKeyPath, privateKeyPassword);
    PublicKey publicKey = certificate.getPublicKey();

    Map<String, Object> output = new LinkedHashMap<>();
    output.put("javaVersion", System.getProperty("java.version"));
    output.put("javaDefaultCharset", Charset.defaultCharset().name());
    output.put("seedProvider", Cipher.getInstance("SEED/CBC/PKCS5Padding", "BC").getProvider().getName());
    Cipher rsaProbe = Cipher.getInstance("RSA");
    output.put("rsaTransformation", rsaProbe.getAlgorithm());
    output.put("rsaProvider", rsaProbe.getProvider().getName());
    output.put("plainUtf8", plainSummary(minimalJson, vehicleNumber));
    output.put("minimal", call(endpoint, apiKey, minimalJson, publicKey, privateKey));
    output.put("full", call(endpoint, apiKey, fullJson, publicKey, privateKey));
    output.put(
      "stagingMinimal",
      call("https://linkstg.car365.go.kr/hub/kotsa", apiKey, minimalJson, publicKey, privateKey)
    );

    System.out.println(toJson(output));
  }

  static Map<String, String> loadEnv(Path path) throws Exception {
    Map<String, String> env = new HashMap<>();

    for (String line : Files.readAllLines(path, StandardCharsets.UTF_8)) {
      String trimmed = line.trim();

      if (trimmed.isEmpty() || trimmed.startsWith("#")) {
        continue;
      }

      int index = trimmed.indexOf('=');

      if (index < 0) {
        continue;
      }

      String key = trimmed.substring(0, index);
      String value = trimmed.substring(index + 1);

      if (
        (value.startsWith("\"") && value.endsWith("\"")) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.substring(1, value.length() - 1);
      }

      env.put(key, value);
    }

    return env;
  }

  static X509Certificate readCertificate(String path) throws Exception {
    CertificateFactory factory = CertificateFactory.getInstance("X.509");

    try (InputStream input = Files.newInputStream(Path.of(path))) {
      return (X509Certificate) factory.generateCertificate(input);
    }
  }

  static PrivateKey readPrivateKey(String path, String password) throws Exception {
    byte[] encryptedPrivateKey = Files.readAllBytes(Path.of(path));
    DerNode root = readNode(encryptedPrivateKey, 0);
    List<DerNode> rootChildren = children(root.value);
    List<DerNode> algorithmChildren = children(rootChildren.get(0).value);
    List<DerNode> parameters = children(algorithmChildren.get(1).value);
    byte[] salt = parameters.get(0).value;
    int iterations = integer(parameters.get(1).value);
    byte[] encryptedData = rootChildren.get(1).value;
    byte[] derived = pbkdf1Sha1(password.getBytes(StandardCharsets.ISO_8859_1), salt, iterations);
    byte[] seedKey = Arrays.copyOfRange(derived, 0, 16);
    byte[] digestBytes = Arrays.copyOfRange(derived, 16, 20);
    byte[] seedIv = Arrays.copyOfRange(MessageDigest.getInstance("SHA-1").digest(digestBytes), 0, 16);
    byte[] pkcs8 = seed(false, encryptedData, seedKey, seedIv);

    return KeyFactory.getInstance("RSA").generatePrivate(new PKCS8EncodedKeySpec(pkcs8));
  }

  static Map<String, Object> call(
    String endpoint,
    String apiKey,
    String json,
    PublicKey publicKey,
    PrivateKey privateKey
  ) throws Exception {
    long startedAt = System.currentTimeMillis();
    PackageParts packageParts = encrypt(json, publicKey, privateKey);
    String base64 = Base64.getEncoder().encodeToString(packageParts.der);
    HttpClient client = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NEVER).build();
    HttpRequest request = HttpRequest
      .newBuilder(URI.create(endpoint))
      .header("Accept", "application/json")
      .header("Content-Type", "application/json")
      .header("cvmis_apikey", apiKey)
      .POST(HttpRequest.BodyPublishers.ofString(base64, StandardCharsets.UTF_8))
      .build();
    Map<String, Object> result = new LinkedHashMap<>();

    result.put("request", packageSummary(json, packageParts, base64));

    try {
      HttpResponse<String> response = client.send(
        request,
        HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8)
      );
      String responseBody = stripRawBody(response.body());
      result.put("http", httpSummary(endpoint, response, base64, System.currentTimeMillis() - startedAt));
      result.put("responseBodyLength", responseBody.getBytes(StandardCharsets.UTF_8).length);

      try {
        String decrypted = decrypt(responseBody, publicKey, privateKey);
        result.put("decryptOk", true);
        result.put("business", businessSummary(decrypted));
        result.put("decryptedMasked", maskJson(decrypted));
      } catch (Exception error) {
        result.put("decryptOk", false);
        result.put("decryptError", error.getClass().getSimpleName());
      }
    } catch (Exception error) {
      result.put("httpError", error.getClass().getSimpleName());
    }

    return result;
  }

  static PackageParts encrypt(String json, PublicKey publicKey, PrivateKey privateKey) throws Exception {
    byte[] seedKey = new byte[16];
    byte[] seedIv = new byte[16];
    SecureRandom secureRandom = new SecureRandom();
    secureRandom.nextBytes(seedKey);
    secureRandom.nextBytes(seedIv);

    byte[] encryptedData = seed(true, json.getBytes(StandardCharsets.UTF_8), seedKey, seedIv);
    Signature signature = Signature.getInstance("SHA256withRSA");
    signature.initSign(privateKey);
    signature.update(encryptedData);
    byte[] signedData = signature.sign();
    Cipher rsa = Cipher.getInstance("RSA");
    rsa.init(Cipher.ENCRYPT_MODE, publicKey);
    byte[] encryptedKey = rsa.doFinal(seedKey);
    rsa = Cipher.getInstance("RSA");
    rsa.init(Cipher.ENCRYPT_MODE, publicKey);
    byte[] encryptedIv = rsa.doFinal(seedIv);
    PackageParts parts = new PackageParts();
    parts.encryptedData = encryptedData;
    parts.signedData = signedData;
    parts.encryptedKey = encryptedKey;
    parts.encryptedIv = encryptedIv;
    parts.der = sequence(octet(encryptedKey), octet(encryptedIv), octet(signedData), octet(encryptedData));

    return parts;
  }

  static String decrypt(String base64, PublicKey publicKey, PrivateKey privateKey) throws Exception {
    byte[] der = Base64.getDecoder().decode(base64);
    List<DerNode> packageChildren = children(readNode(der, 0).value);
    byte[] encryptedKey = packageChildren.get(0).value;
    byte[] encryptedIv = packageChildren.get(1).value;
    byte[] signedData = packageChildren.get(2).value;
    byte[] encryptedData = packageChildren.get(3).value;
    Signature signature = Signature.getInstance("SHA256withRSA");
    signature.initVerify(publicKey);
    signature.update(encryptedData);

    if (!signature.verify(signedData)) {
      throw new SecurityException("signature");
    }

    Cipher rsa = Cipher.getInstance("RSA");
    rsa.init(Cipher.DECRYPT_MODE, privateKey);
    byte[] seedKey = rsa.doFinal(encryptedKey);
    rsa = Cipher.getInstance("RSA");
    rsa.init(Cipher.DECRYPT_MODE, privateKey);
    byte[] seedIv = rsa.doFinal(encryptedIv);

    return new String(seed(false, encryptedData, seedKey, seedIv), StandardCharsets.UTF_8);
  }

  static byte[] seed(boolean encrypt, byte[] input, byte[] key, byte[] iv) throws Exception {
    Cipher cipher = Cipher.getInstance("SEED/CBC/PKCS5Padding", "BC");
    cipher.init(
      encrypt ? Cipher.ENCRYPT_MODE : Cipher.DECRYPT_MODE,
      new SecretKeySpec(key, "SEED"),
      new IvParameterSpec(iv)
    );

    return cipher.doFinal(input);
  }

  static byte[] pbkdf1Sha1(byte[] password, byte[] salt, int iterations) throws Exception {
    MessageDigest digest = MessageDigest.getInstance("SHA-1");
    digest.update(password);
    digest.update(salt);
    byte[] output = digest.digest();

    for (int index = 1; index < iterations; index += 1) {
      output = MessageDigest.getInstance("SHA-1").digest(output);
    }

    return output;
  }

  static DerLength length(byte[] data, int offset) {
    int first = data[offset] & 0xff;

    if (first < 0x80) {
      return new DerLength(first, offset + 1);
    }

    int count = first & 0x7f;
    int value = 0;
    int next = offset + 1;

    for (int index = 0; index < count; index += 1) {
      value = (value << 8) | (data[next++] & 0xff);
    }

    return new DerLength(value, next);
  }

  static DerNode readNode(byte[] data, int offset) {
    int tag = data[offset] & 0xff;
    DerLength length = length(data, offset + 1);

    return new DerNode(
      tag,
      Arrays.copyOfRange(data, length.next, length.next + length.length),
      length.next + length.length
    );
  }

  static List<DerNode> children(byte[] value) {
    ArrayList<DerNode> result = new ArrayList<>();
    int offset = 0;

    while (offset < value.length) {
      DerNode child = readNode(value, offset);
      result.add(child);
      offset = child.next;
    }

    return result;
  }

  static int integer(byte[] value) {
    int result = 0;

    for (byte b : value) {
      result = (result << 8) | (b & 0xff);
    }

    return result;
  }

  static byte[] encodeLength(int length) {
    if (length < 0x80) {
      return new byte[] { (byte) length };
    }

    ArrayList<Byte> bytes = new ArrayList<>();

    while (length > 0) {
      bytes.add(0, (byte) (length & 0xff));
      length >>= 8;
    }

    byte[] result = new byte[bytes.size() + 1];
    result[0] = (byte) (0x80 | bytes.size());

    for (int index = 0; index < bytes.size(); index += 1) {
      result[index + 1] = bytes.get(index);
    }

    return result;
  }

  static byte[] node(int tag, byte[] value) throws Exception {
    ByteArrayOutputStream output = new ByteArrayOutputStream();
    output.write(tag);
    output.write(encodeLength(value.length));
    output.write(value);

    return output.toByteArray();
  }

  static byte[] octet(byte[] value) throws Exception {
    return node(0x04, value);
  }

  static byte[] sequence(byte[]... children) throws Exception {
    ByteArrayOutputStream value = new ByteArrayOutputStream();

    for (byte[] child : children) {
      value.write(child);
    }

    return node(0x30, value.toByteArray());
  }

  static String sha256(byte[] input) throws Exception {
    byte[] digest = MessageDigest.getInstance("SHA-256").digest(input);
    StringBuilder builder = new StringBuilder();

    for (byte b : digest) {
      builder.append(String.format("%02x", b));
    }

    return builder.toString();
  }

  static String stripRawBody(String body) {
    String trimmed = body.trim();

    if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
      return trimmed.substring(1, trimmed.length() - 1);
    }

    return trimmed;
  }

  static Map<String, Object> plainSummary(String json, String vehicleNumber) throws Exception {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("byteLength", json.getBytes(StandardCharsets.UTF_8).length);
    summary.put("sha256", sha256(json.getBytes(StandardCharsets.UTF_8)));
    summary.put("vehicleStringLength", vehicleNumber.codePointCount(0, vehicleNumber.length()));
    summary.put("vehicleByteLength", vehicleNumber.getBytes(StandardCharsets.UTF_8).length);
    summary.put("bom", false);

    return summary;
  }

  static Map<String, Object> packageSummary(String json, PackageParts parts, String base64) throws Exception {
    Map<String, Object> summary = new LinkedHashMap<>();
    summary.put("plainByteLength", json.getBytes(StandardCharsets.UTF_8).length);
    summary.put("plainSha256", sha256(json.getBytes(StandardCharsets.UTF_8)));
    summary.put("seedEncryptedMessageLength", parts.encryptedData.length);
    summary.put("signedDataLength", parts.signedData.length);
    summary.put("encryptedKeyLength", parts.encryptedKey.length);
    summary.put("encryptedIvLength", parts.encryptedIv.length);
    summary.put("derSequenceObjectCount", 4);
    summary.put("derTags", Arrays.asList("0x04", "0x04", "0x04", "0x04"));
    summary.put("derTotalLength", parts.der.length);
    summary.put("base64Length", base64.length());

    return summary;
  }

  static Map<String, Object> httpSummary(
    String endpoint,
    HttpResponse<String> response,
    String body,
    long responseTimeMs
  ) {
    Map<String, Object> summary = new LinkedHashMap<>();
    URI uri = URI.create(endpoint);
    summary.put("method", "POST");
    summary.put("url", endpoint);
    summary.put("host", uri.getHost());
    summary.put("accept", "application/json");
    summary.put("contentType", "application/json");
    summary.put("contentLength", body.getBytes(StandardCharsets.UTF_8).length);
    summary.put("bodyLastChar", body.substring(body.length() - 1));
    summary.put("bodyHasNewline", body.endsWith("\n"));
    summary.put("status", response.statusCode());
    summary.put("responseTimeMs", responseTimeMs);
    Map<String, Object> headers = new LinkedHashMap<>();

    for (String key : Arrays.asList(
      "hub_result",
      "hub_result_code",
      "date",
      "server",
      "content-type",
      "content-length",
      "transfer-encoding",
      "connection",
      "transaction_id"
    )) {
      headers.put(key, response.headers().firstValue(key).orElse(null));
    }

    summary.put("headers", headers);

    return summary;
  }

  static Map<String, Object> businessSummary(String json) {
    Map<String, Object> summary = new LinkedHashMap<>();

    for (String key : Arrays.asList("linkRsltCd", "linkRsltDtl", "prcsImprtyRsnCd", "prcsImprtyRsnDtls")) {
      summary.put(key, extract(json, key));
    }

    summary.put("atmbNmExists", existsNonNull(json, "atmbNm"));
    summary.put("recordExists", json.contains("\"record\"") && !json.contains("\"record\":null"));

    return summary;
  }

  static String extract(String json, String key) {
    String pattern = "\"" + key + "\":";
    int index = json.indexOf(pattern);

    if (index < 0) {
      return null;
    }

    int start = index + pattern.length();

    if (json.startsWith("null", start)) {
      return null;
    }

    if (json.charAt(start) == '"') {
      int end = json.indexOf('"', start + 1);
      return json.substring(start + 1, end);
    }

    int end = start;

    while (end < json.length() && ",}".indexOf(json.charAt(end)) < 0) {
      end += 1;
    }

    return json.substring(start, end);
  }

  static boolean existsNonNull(String json, String key) {
    String pattern = "\"" + key + "\":";
    int index = json.indexOf(pattern);

    return index >= 0 && !json.startsWith("null", index + pattern.length());
  }

  static String maskJson(String json) {
    return json.replaceAll(
      "\\\"(vhclNo|vhrno)\\\"\\s*:\\s*\\\"[^\\\"]*\\\"",
      "\\\"$1\\\":\\\"" + MASKED_VEHICLE + "\\\""
    );
  }

  static String escape(String value) {
    if (value == null) {
      return "null";
    }

    StringBuilder builder = new StringBuilder("\"");

    for (char c : value.toCharArray()) {
      if (c == '\\' || c == '"') {
        builder.append('\\').append(c);
      } else if (c == '\n') {
        builder.append("\\n");
      } else if (c < 32) {
        builder.append(String.format("\\u%04x", (int) c));
      } else {
        builder.append(c);
      }
    }

    return builder.append('"').toString();
  }

  static String toJson(Object value) {
    if (value == null) {
      return "null";
    }

    if (value instanceof String) {
      return escape((String) value);
    }

    if (value instanceof Number || value instanceof Boolean) {
      return value.toString();
    }

    if (value instanceof Map) {
      StringBuilder builder = new StringBuilder("{");
      boolean first = true;

      for (Object entryValue : ((Map<?, ?>) value).entrySet()) {
        Map.Entry<?, ?> entry = (Map.Entry<?, ?>) entryValue;

        if (!first) {
          builder.append(',');
        }

        first = false;
        builder.append(escape(String.valueOf(entry.getKey()))).append(':').append(toJson(entry.getValue()));
      }

      return builder.append('}').toString();
    }

    if (value instanceof Iterable) {
      StringBuilder builder = new StringBuilder("[");
      boolean first = true;

      for (Object item : (Iterable<?>) value) {
        if (!first) {
          builder.append(',');
        }

        first = false;
        builder.append(toJson(item));
      }

      return builder.append(']').toString();
    }

    return escape(String.valueOf(value));
  }
}
