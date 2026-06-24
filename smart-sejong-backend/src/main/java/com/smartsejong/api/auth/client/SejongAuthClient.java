package com.smartsejong.api.auth.client;

import com.smartsejong.api.auth.dto.SejongStudentInfo;
import com.smartsejong.api.exception.CustomException;
import com.smartsejong.api.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import okhttp3.Cookie;
import okhttp3.CookieJar;
import okhttp3.FormBody;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import javax.net.ssl.HostnameVerifier;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.IOException;
import java.net.URI;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.net.HttpCookie;
import java.security.cert.X509Certificate;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Slf4j
@Component
public class SejongAuthClient {

    private static final String PORTAL_BASE_URL = "https://portal.sejong.ac.kr";
    private static final String LOGIN_URL = PORTAL_BASE_URL + "/jsp/login/login_action.jsp";
    private static final String SSO_URL = "http://classic.sejong.ac.kr/_custom/sejong/sso/sso-return.jsp?returnUrl=https://classic.sejong.ac.kr/classic/index.do";
    private static final String STATUS_URL = "https://classic.sejong.ac.kr/classic/reading/status.do";
    private static final String USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
    private static final Pattern PORTAL_RESULT_PATTERN = Pattern.compile("var\\s+result\\s*=\\s*['\"]([^'\"]+)['\"]");
    private static final List<String> LOGIN_FAILURE_MARKERS = List.of(
            "fail",
            "invalid",
            "\uBD88\uC77C\uCE58",
            "\uC874\uC7AC\uD558\uC9C0 \uC54A\uB294",
            "\uC2E4\uD328",
            "erridpwd",
            "pwdNeedChg",
            "invalidDt",
            "\uC544\uC774\uB514\uB098 \uBE44\uBC00\uBC88\uD638\uAC00 \uC77C\uCE58\uD558\uC9C0 \uC54A\uC2B5\uB2C8\uB2E4"
    );

    public SejongStudentInfo authenticate(String studentId, String password) {
        PortalSession session = buildUnsafeSession();

        try {
            executePortalLogin(session, studentId, password);
            executeSsoRedirect(session.client());

            String html = fetchStatusPageHtml(session.client());
            return parseUserInfo(html, studentId);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("Sejong portal authentication failed unexpectedly: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
        }
    }

    private void executePortalLogin(PortalSession session, String id, String pw) throws IOException {
        RequestBody formBody = new FormBody.Builder()
                .add("mainLogin", "N")
                .add("id", id)
                .add("password", pw)
                .build();

        Request request = new Request.Builder()
                .url(LOGIN_URL)
                .post(formBody)
                .header("Referer", PORTAL_BASE_URL)
                .header("User-Agent", USER_AGENT)
                .build();

        try (Response response = session.client().newCall(request).execute()) {
            String body = response.body() != null ? response.body().string() : "";

            if (!response.isSuccessful()) {
                log.warn("Sejong portal login returned HTTP {} - studentId: {}", response.code(), id);
                throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
            }

            String result = extractPortalLoginResult(body);
            if (result != null) {
                if (!"OK".equalsIgnoreCase(result)) {
                    log.warn("Sejong portal rejected credentials - studentId: {}, result={}", id, result);
                    throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
                }
            } else if (containsAnyIgnoreCase(body, LOGIN_FAILURE_MARKERS)) {
                    log.warn("Sejong portal rejected credentials - studentId: {}", id);
                    throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
            }

            log.debug("Sejong portal login response URL: {}", response.request().url());
        } catch (IOException e) {
            log.warn("OkHttp portal login request failed. Falling back to curl. cause={}", e.getMessage());
            executePortalLoginWithCurl(session.cookieManager(), id, pw);
        }
    }

    private void executePortalLoginWithCurl(CookieManager cookieManager, String id, String pw) throws IOException {
        Path cookieFile = Files.createTempFile("sejong-portal-cookies", ".txt");
        try {
            Process process = new ProcessBuilder(
                    "curl.exe",
                    "-sk",
                    "-X", "POST",
                    LOGIN_URL,
                    "-H", "Referer: " + PORTAL_BASE_URL,
                    "-H", "User-Agent: " + USER_AGENT,
                    "--data-urlencode", "mainLogin=N",
                    "--data-urlencode", "id=" + id,
                    "--data-urlencode", "password=" + pw,
                    "-c", cookieFile.toString()
            ).redirectErrorStream(true).start();

            String body = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            try {
                boolean finished = process.waitFor(30, TimeUnit.SECONDS);
                if (!finished) {
                    process.destroyForcibly();
                    throw new IOException("curl login timed out");
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new IOException("curl login interrupted", e);
            }

            if (process.exitValue() != 0) {
                log.warn("curl portal login failed with exit code {}", process.exitValue());
                throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
            }

            String result = extractPortalLoginResult(body);
            if (result != null) {
                if (!"OK".equalsIgnoreCase(result)) {
                    log.warn("Sejong portal rejected credentials via curl - studentId: {}, result={}", id, result);
                    throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
                }
            } else if (containsAnyIgnoreCase(body, LOGIN_FAILURE_MARKERS)) {
                    log.warn("Sejong portal rejected credentials via curl - studentId: {}", id);
                    throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
            }

            importCurlCookies(cookieManager, cookieFile);
            log.debug("Sejong portal login completed via curl fallback - studentId: {}", id);
        } finally {
            Files.deleteIfExists(cookieFile);
        }
    }

    private void importCurlCookies(CookieManager cookieManager, Path cookieFile) throws IOException {
        for (String line : Files.readAllLines(cookieFile, StandardCharsets.UTF_8)) {
            if (line.isBlank() || line.startsWith("#")) {
                continue;
            }

            String[] parts = line.split("\t");
            if (parts.length < 7) {
                continue;
            }

            String domain = parts[0].startsWith(".") ? parts[0].substring(1) : parts[0];
            String path = parts[2].isBlank() ? "/" : parts[2];
            String name = parts[5];
            String value = parts[6];

            HttpCookie cookie = new HttpCookie(name, value);
            cookie.setDomain(domain);
            cookie.setPath(path);
            cookieManager.getCookieStore().add(URI.create("https://" + domain), cookie);
        }
    }

    private void executeSsoRedirect(OkHttpClient client) throws IOException {
        Request request = new Request.Builder()
                .url(SSO_URL)
                .get()
                .header("User-Agent", USER_AGENT)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (!response.isSuccessful()) {
                log.error("Classic SSO redirect failed: {}", response.code());
                throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
            }
            log.debug("Classic SSO response URL: {}", response.request().url());
        }
    }

    private String fetchStatusPageHtml(OkHttpClient client) throws IOException {
        Request request = new Request.Builder()
                .url(STATUS_URL)
                .get()
                .header("User-Agent", USER_AGENT)
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.body() == null || response.code() != 200) {
                log.error("Classic status page request failed: {}", response.code());
                throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
            }

            String html = response.body().string();
            String finalUrl = response.request().url().toString();
            if (finalUrl.contains("/login") || html.contains("loginForm")) {
                log.warn("Classic status page returned a login page. finalUrl={}", finalUrl);
                throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
            }

            return html;
        }
    }

    private SejongStudentInfo parseUserInfo(String html, String studentId) {
        Document doc = Jsoup.parse(html);
        List<String> values = extractUserInfoValues(doc);

        if (values.size() < 5) {
            log.error("Not enough user info values. count={}, title={}, tableCount={}",
                    values.size(), doc.title(), doc.select("table").size());
            throw new CustomException(ErrorCode.SEJONG_AUTH_FAILED);
        }

        String major = values.get(0);
        String name = values.get(2);
        String grade = values.get(3).replaceAll("[^0-9]", "");

        log.info("Sejong portal authentication succeeded - studentId: {}, name: {}, major: {}, grade: {}",
                studentId, name, major, grade);

        return SejongStudentInfo.builder()
                .studentId(studentId)
                .fullName(name)
                .major(major)
                .build();
    }

    private List<String> extractUserInfoValues(Document doc) {
        List<String> values = extractTableValues(doc.select(".b-con-box table.b-board-table tbody tr"));
        if (values.size() >= 5) {
            return values;
        }

        values = extractTableValues(doc.select("table.b-board-table tbody tr"));
        if (values.size() >= 5) {
            return values;
        }

        return extractTableValues(doc.select("table tbody tr"));
    }

    private List<String> extractTableValues(Elements rows) {
        List<String> values = new ArrayList<>();
        for (Element row : rows) {
            String value = row.select("td").text().trim();
            if (!value.isBlank()) {
                values.add(value);
            }
        }
        return values;
    }

    private boolean containsAnyIgnoreCase(String text, List<String> markers) {
        if (text == null || text.isBlank()) {
            return false;
        }

        String lowerText = text.toLowerCase();
        return markers.stream()
                .map(String::toLowerCase)
                .anyMatch(lowerText::contains);
    }

    private String extractPortalLoginResult(String body) {
        if (body == null || body.isBlank()) {
            return null;
        }

        Matcher matcher = PORTAL_RESULT_PATTERN.matcher(body);
        return matcher.find() ? matcher.group(1) : null;
    }

    private PortalSession buildUnsafeSession() {
        try {
            TrustManager[] trustAllCerts = new TrustManager[]{
                    new X509TrustManager() {
                        @Override
                        public void checkClientTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public void checkServerTrusted(X509Certificate[] chain, String authType) {
                        }

                        @Override
                        public X509Certificate[] getAcceptedIssuers() {
                            return new X509Certificate[0];
                        }
                    }
            };

            SSLContext sslContext = SSLContext.getInstance("SSL");
            sslContext.init(null, trustAllCerts, new java.security.SecureRandom());

            CookieManager cookieManager = new CookieManager();
            cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

            OkHttpClient client = new OkHttpClient.Builder()
                    .sslSocketFactory(sslContext.getSocketFactory(), (X509TrustManager) trustAllCerts[0])
                    .hostnameVerifier(trustAllHostnames())
                    .cookieJar(new JavaNetCookieJar(cookieManager))
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .followRedirects(true)
                    .followSslRedirects(true)
                    .build();
            return new PortalSession(client, cookieManager);
        } catch (Exception e) {
            log.error("Failed to create HTTP client", e);
            throw new RuntimeException("Failed to create HTTP client", e);
        }
    }

    private HostnameVerifier trustAllHostnames() {
        return (hostname, session) -> true;
    }

    private record PortalSession(OkHttpClient client, CookieManager cookieManager) {
    }

    private static class JavaNetCookieJar implements CookieJar {
        private final CookieManager cookieManager;

        JavaNetCookieJar(CookieManager cookieManager) {
            this.cookieManager = cookieManager;
        }

        @Override
        public void saveFromResponse(HttpUrl url, List<Cookie> cookies) {
            for (Cookie cookie : cookies) {
                cookieManager.getCookieStore().add(
                        url.uri(),
                        new java.net.HttpCookie(cookie.name(), cookie.value())
                );
            }
        }

        @Override
        public List<Cookie> loadForRequest(HttpUrl url) {
            List<Cookie> cookies = new ArrayList<>();
            for (java.net.HttpCookie httpCookie : cookieManager.getCookieStore().getCookies()) {
                Cookie cookie = new Cookie.Builder()
                        .domain(url.host())
                        .path("/")
                        .name(httpCookie.getName())
                        .value(httpCookie.getValue())
                        .build();
                cookies.add(cookie);
            }
            return cookies;
        }
    }
}
