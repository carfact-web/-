import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;

public class KotsaOriginalRunner {
    public static void main(String[] args) throws Exception {
        Map<String, String> env = loadEnv("/root/carfact/.env.local");
        String vehicleNumber = new String(new int[] { 0x33, 0x39, 0x30, 0xC6B0, 0x36, 0x39, 0x34, 0x32 }, 0, 8);
        String requestJson = "{\"data\":[{\"linkInfoCd\":\"AC1_ZA90_01\",\"vhclNo\":\"" + vehicleNumber + "\"}]}";
        KotsaSecurity kotsa = new KotsaSecurity(
                env.get("KOTSA_CERT_PATH"),
                env.get("KOTSA_PRIVATE_KEY_PATH"),
                env.get("KOTSA_PRIVATE_KEY_PASSWORD")
        );
        String encrypted = kotsa.realtimeEncrypt(requestJson);
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder(URI.create(env.get("KOTSA_API_BASE_URL")))
                .header("Accept", "application/json")
                .header("Content-Type", "application/json")
                .header("cvmis_apikey", env.get("KOTSA_API_KEY"))
                .POST(HttpRequest.BodyPublishers.ofString(encrypted, StandardCharsets.UTF_8))
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        String responseBody = stripBody(response.body());
        String decrypted = null;
        boolean decryptOk = false;

        try {
            decrypted = kotsa.realtimeDecrypt(responseBody);
            decryptOk = true;
        } catch (Exception error) {
            decrypted = "";
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("source", "HWPX guide embedded KotsaSecurity");
        result.put("maskedVehicle", "390\uC6B0****");
        result.put("httpStatus", response.statusCode());
        result.put("hub_result", response.headers().firstValue("hub_result").orElse(null));
        result.put("hub_result_code", response.headers().firstValue("hub_result_code").orElse(null));
        result.put("transaction_id", response.headers().firstValue("transaction_id").orElse(null));
        result.put("decryptOk", decryptOk);
        result.put("linkRsltCd", extract(decrypted, "linkRsltCd"));
        result.put("linkRsltDtl", extract(decrypted, "linkRsltDtl"));
        result.put("prcsImprtyRsnCd", extract(decrypted, "prcsImprtyRsnCd"));
        result.put("prcsImprtyRsnDtls", extract(decrypted, "prcsImprtyRsnDtls"));
        result.put("atmbNmExists", existsNonNull(decrypted, "atmbNm"));
        result.put("recordExists", decrypted.contains("\"record\"") && !decrypted.contains("\"record\":null"));
        System.out.println(toJson(result));
    }

    private static Map<String, String> loadEnv(String path) throws Exception {
        Map<String, String> env = new HashMap<>();

        for (String line : Files.readAllLines(Paths.get(path), StandardCharsets.UTF_8)) {
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

            if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.substring(1, value.length() - 1);
            }

            env.put(key, value);
        }

        return env;
    }

    private static String stripBody(String body) {
        String trimmed = body.trim();

        if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
            return trimmed.substring(1, trimmed.length() - 1);
        }

        return trimmed;
    }

    private static String extract(String json, String key) {
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

    private static boolean existsNonNull(String json, String key) {
        String pattern = "\"" + key + "\":";
        int index = json.indexOf(pattern);

        return index >= 0 && !json.startsWith("null", index + pattern.length());
    }

    private static String toJson(Map<String, Object> values) {
        StringBuilder builder = new StringBuilder("{");
        boolean first = true;

        for (Map.Entry<String, Object> entry : values.entrySet()) {
            if (!first) {
                builder.append(',');
            }

            first = false;
            builder.append(quote(entry.getKey())).append(':');
            Object value = entry.getValue();

            if (value == null) {
                builder.append("null");
            } else if (value instanceof Number || value instanceof Boolean) {
                builder.append(value);
            } else {
                builder.append(quote(String.valueOf(value)));
            }
        }

        return builder.append('}').toString();
    }

    private static String quote(String value) {
        StringBuilder builder = new StringBuilder("\"");

        for (char c : value.toCharArray()) {
            if (c == '\\' || c == '"') {
                builder.append('\\').append(c);
            } else if (c == '\n') {
                builder.append("\\n");
            } else {
                builder.append(c);
            }
        }

        return builder.append('"').toString();
    }
}
