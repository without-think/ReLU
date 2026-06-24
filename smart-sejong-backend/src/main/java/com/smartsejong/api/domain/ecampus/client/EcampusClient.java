package com.smartsejong.api.domain.ecampus.client;

import com.smartsejong.api.domain.ecampus.dto.EcampusAssignmentInfo;
import com.smartsejong.api.domain.ecampus.dto.EcampusCourseInfo;
import com.smartsejong.api.exception.CustomException;
import com.smartsejong.api.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import okhttp3.*;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;

import javax.net.ssl.*;
import java.io.IOException;
import java.net.CookieManager;
import java.net.CookiePolicy;
import java.security.cert.X509Certificate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * e캠퍼스(집현캠퍼스) 스크래핑 클라이언트 — Moodle/Coursemos 기반
 *
 * 로그인: POST /login/index.php (ssoGubun=Login, 포탈 계정으로 직접 인증)
 * 현재학기 강의목록: /dashboard.php
 * 이전학기 강의목록: /local/ubion/user/index.php?year={year}&semester={semester}
 *   semester 코드: 10=1학기, 20=2학기, 11=여름계절, 21=겨울계절, all=전체
 * 과제목록: /mod/assign/index.php?id={courseId}
 * 과제 제출 시간: /mod/assign/view.php?id={assignId} 의 "최종 수정 일시"
 */
@Slf4j
@Component
public class EcampusClient {

    private static final String BASE_URL = "https://ecampus.sejong.ac.kr";
    private static final String LOGIN_URL = BASE_URL + "/login/index.php";
    private static final String DASHBOARD_URL = BASE_URL + "/dashboard.php";
    private static final String PAST_COURSE_URL = BASE_URL + "/local/ubion/user/index.php?year=%s&semester=%s";
    private static final String ASSIGNMENT_LIST_URL = BASE_URL + "/mod/assign/index.php?id=%s";
    private static final String ASSIGNMENT_DETAIL_URL = BASE_URL + "/mod/assign/view.php?id=%s";

    // dashboard.php 강의 목록 셀렉터
    private static final String CURRENT_COURSE_ITEM_SELECTOR = "ul.my-course-lists li";
    private static final String CURRENT_COURSE_NAME_SELECTOR = "div.course-title h3";
    private static final String CURRENT_COURSE_PROFESSOR_SELECTOR = "span.prof";
    private static final String CURRENT_COURSE_LINK_SELECTOR = "a.course-link";

    // local/ubion/user/index.php 이전학기 강의 셀렉터
    private static final String PAST_COURSE_LINK_SELECTOR = "a.coursefullname";

    // mod/assign/index.php 과제 목록 셀렉터
    // 컬럼 순서: 주(c0) | 과제명(c1) | 종료 일시(c2) | 제출(c3) | 성적(c4)
    private static final String ASSIGNMENT_ROW_SELECTOR = "table.generaltable tbody tr";
    private static final String ASSIGNMENT_TITLE_SELECTOR = "td.cell.c1 a";
    private static final String ASSIGNMENT_DEADLINE_SELECTOR = "td.cell.c2";
    private static final String ASSIGNMENT_STATUS_SELECTOR = "td.cell.c3";

    // mod/assign/view.php 제출 시간 레이블 (한/영 모두 지원)
    private static final String SUBMIT_TIME_LABEL_KO = "최종 수정 일시";
    private static final String SUBMIT_TIME_LABEL_EN = "Last modified";

    // ecampus 날짜 형식: "2026-04-20 23:59"
    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    public List<EcampusCourseInfo> fetchCurrentSemester(String studentId, String password) {
        OkHttpClient sessionClient = buildUnsafeClient();
        try {
            login(sessionClient, studentId, password);
            return scrapeCurrentCourses(sessionClient);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("e캠퍼스 스크래핑 중 오류: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.ECAMPUS_SCRAPE_FAILED);
        }
    }

    public List<EcampusCourseInfo> fetchPastSemester(String studentId, String password, String year, String semester) {
        OkHttpClient sessionClient = buildUnsafeClient();
        try {
            login(sessionClient, studentId, password);
            return scrapePastCourses(sessionClient, year, semester);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("e캠퍼스 이전학기 스크래핑 중 오류: {}", e.getMessage(), e);
            throw new CustomException(ErrorCode.ECAMPUS_SCRAPE_FAILED);
        }
    }

    private void login(OkHttpClient client, String studentId, String password) throws IOException {
        RequestBody body = new FormBody.Builder()
                .add("ssoGubun", "Login")
                .add("type", "popup_login")
                .add("username", studentId)
                .add("password", password)
                .build();

        Request request = new Request.Builder()
                .url(LOGIN_URL)
                .post(body)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .header("Referer", BASE_URL + "/login/index.php")
                .build();

        try (Response response = client.newCall(request).execute()) {
            String responseBody = response.body() != null ? response.body().string() : "";
            String finalUrl = response.request().url().toString();
            log.info("ecampus 로그인 응답 URL: {}", finalUrl);

            boolean loginFailed = finalUrl.contains("/login") ||
                    responseBody.contains("잘못된 아이디") ||
                    responseBody.contains("Invalid login");
            if (loginFailed) {
                log.warn("e캠퍼스 로그인 실패 - 학번: {}", studentId);
                throw new CustomException(ErrorCode.ECAMPUS_AUTH_FAILED);
            }
        }
    }

    private List<EcampusCourseInfo> scrapeCurrentCourses(OkHttpClient client) throws IOException {
        String html = fetchPage(client, DASHBOARD_URL);
        Document doc = Jsoup.parse(html);

        Elements courseElements = doc.select(CURRENT_COURSE_ITEM_SELECTOR);
        log.info("현재학기 강의 {}개 발견", courseElements.size());

        List<EcampusCourseInfo> courses = new ArrayList<>();
        for (Element el : courseElements) {
            String courseName = el.select(CURRENT_COURSE_NAME_SELECTOR).text().trim();
            String professor = el.select(CURRENT_COURSE_PROFESSOR_SELECTOR).text()
                    .replace(" ", "").trim();
            Element linkEl = el.selectFirst(CURRENT_COURSE_LINK_SELECTOR);

            if (courseName.isEmpty() || linkEl == null) continue;

            String courseId = extractIdFromUrl(linkEl.attr("href"));
            List<EcampusAssignmentInfo> assignments = fetchAssignments(client, courseId);

            courses.add(EcampusCourseInfo.builder()
                    .courseId(courseId)
                    .courseName(courseName)
                    .professor(professor)
                    .assignments(assignments)
                    .build());
        }
        return courses;
    }

    private List<EcampusCourseInfo> scrapePastCourses(OkHttpClient client, String year, String semester) throws IOException {
        String url = String.format(PAST_COURSE_URL, year, semester);
        String html = fetchPage(client, url);
        Document doc = Jsoup.parse(html);

        Elements courseLinks = doc.select(PAST_COURSE_LINK_SELECTOR);
        log.info("이전학기({}-{}) 강의 {}개 발견", year, semester, courseLinks.size());

        List<EcampusCourseInfo> courses = new ArrayList<>();
        for (Element linkEl : courseLinks) {
            String courseName = linkEl.text().trim();
            String courseId = extractIdFromUrl(linkEl.attr("href"));
            if (courseName.isEmpty() || courseId.isEmpty()) continue;

            List<EcampusAssignmentInfo> assignments = fetchAssignments(client, courseId);
            courses.add(EcampusCourseInfo.builder()
                    .courseId(courseId)
                    .courseName(courseName)
                    .professor("")
                    .assignments(assignments)
                    .build());
        }
        return courses;
    }

    private List<EcampusAssignmentInfo> fetchAssignments(OkHttpClient client, String courseId) throws IOException {
        String url = String.format(ASSIGNMENT_LIST_URL, courseId);
        String html = fetchPage(client, url);
        Document doc = Jsoup.parse(html);

        List<EcampusAssignmentInfo> assignments = new ArrayList<>();
        for (Element row : doc.select(ASSIGNMENT_ROW_SELECTOR)) {
            Element titleEl = row.selectFirst(ASSIGNMENT_TITLE_SELECTOR);
            if (titleEl == null) continue;

            String title = titleEl.text().trim();
            String assignId = extractIdFromUrl(titleEl.attr("href"));
            String deadlineText = row.select(ASSIGNMENT_DEADLINE_SELECTOR).text().trim();
            String statusText = row.select(ASSIGNMENT_STATUS_SELECTOR).text().trim();

            boolean submitted = statusText.contains("제출 완료") || statusText.contains("Submitted");
            LocalDateTime submittedAt = submitted ? fetchSubmittedAt(client, assignId) : null;

            assignments.add(EcampusAssignmentInfo.builder()
                    .assignmentId(assignId)
                    .title(title)
                    .deadline(parseDateTime(deadlineText))
                    .submittedAt(submittedAt)
                    .submitted(submitted)
                    .build());
        }
        return assignments;
    }

    private LocalDateTime fetchSubmittedAt(OkHttpClient client, String assignId) {
        try {
            String url = String.format(ASSIGNMENT_DETAIL_URL, assignId);
            String html = fetchPage(client, url);
            Document doc = Jsoup.parse(html);

            // "최종 수정 일시" 레이블 행의 다음 td 값 파싱
            for (Element row : doc.select("table.generaltable tr")) {
                String label = row.select("td.cell.c0").text().trim();
                if (SUBMIT_TIME_LABEL_KO.equals(label) || SUBMIT_TIME_LABEL_EN.equals(label)) {
                    String value = row.select("td.cell.c1").text().trim();
                    return parseDateTime(value);
                }
            }
        } catch (Exception e) {
            log.debug("과제 제출 시간 조회 실패 (assignId={}): {}", assignId, e.getMessage());
        }
        return null;
    }

    private String fetchPage(OkHttpClient client, String url) throws IOException {
        Request request = new Request.Builder()
                .url(url)
                .get()
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
                .build();

        try (Response response = client.newCall(request).execute()) {
            if (response.body() == null) throw new CustomException(ErrorCode.ECAMPUS_SCRAPE_FAILED);
            return response.body().string();
        }
    }

    private String extractIdFromUrl(String url) {
        if (url == null) return "";
        if (url.contains("id=")) return url.replaceAll(".*[?&]id=([^&]+).*", "$1");
        return "";
    }

    private LocalDateTime parseDateTime(String text) {
        if (text == null || text.isBlank() || "-".equals(text.trim())) return null;
        try {
            return LocalDateTime.parse(text.trim(), DATE_FORMATTER);
        } catch (DateTimeParseException e) {
            log.debug("날짜 파싱 실패 (원문: '{}')", text);
            return null;
        }
    }

    private OkHttpClient buildUnsafeClient() {
        try {
            TrustManager[] trustAll = new TrustManager[]{
                    new X509TrustManager() {
                        public void checkClientTrusted(X509Certificate[] c, String a) {}
                        public void checkServerTrusted(X509Certificate[] c, String a) {}
                        public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
                    }
            };
            SSLContext sslContext = SSLContext.getInstance("SSL");
            sslContext.init(null, trustAll, new java.security.SecureRandom());

            CookieManager cookieManager = new CookieManager();
            cookieManager.setCookiePolicy(CookiePolicy.ACCEPT_ALL);

            return new OkHttpClient.Builder()
                    .sslSocketFactory(sslContext.getSocketFactory(), (X509TrustManager) trustAll[0])
                    .hostnameVerifier((h, s) -> true)
                    .cookieJar(new JavaNetCookieJar(cookieManager))
                    .connectTimeout(30, TimeUnit.SECONDS)
                    .readTimeout(30, TimeUnit.SECONDS)
                    .writeTimeout(30, TimeUnit.SECONDS)
                    .followRedirects(true)
                    .followSslRedirects(true)
                    .build();
        } catch (Exception e) {
            throw new RuntimeException("HTTP 클라이언트 생성 실패", e);
        }
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
                cookies.add(new Cookie.Builder()
                        .domain(url.host())
                        .path("/")
                        .name(httpCookie.getName())
                        .value(httpCookie.getValue())
                        .build());
            }
            return cookies;
        }
    }
}
