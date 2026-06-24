package com.smartsejong.api.domain.group.client;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.client.MultipartBodyBuilder;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

@Component
public class AiDataClient {

    private final WebClient client;

    public AiDataClient(@Qualifier("aiWebClient") WebClient client) {
        this.client = client;
    }

    private <T> List<T> fetchList(String uri, Class<T[]> type, int timeoutSec) {
        try {
            T[] rows = client.get().uri(uri)
                    .retrieve().bodyToMono(type)
                    .timeout(Duration.ofSeconds(timeoutSec)).block();
            return rows == null ? List.of() : Arrays.asList(rows);
        } catch (WebClientResponseException e) {
            throw new AiDataException("FastAPI " + e.getStatusCode() + " for " + uri, e);
        } catch (RuntimeException e) {
            throw new AiDataException("FastAPI request failed: " + uri, e);
        }
    }

    public List<TemperatureRow> fetchTemperature() {
        return fetchList("/api/temperature", TemperatureRow[].class, 10);
    }

    public List<TemperatureRow> fetchTemperatureLive(String asOf) {
        String uri = (asOf != null && !asOf.isBlank())
                ? "/api/temperature/live?as_of=" + asOf
                : "/api/temperature/live";
        return fetchList(uri, TemperatureRow[].class, 30);
    }

    public List<MemberRow> fetchMembers() {
        return fetchList("/api/members", MemberRow[].class, 10);
    }

    public List<PeerReviewRow> fetchPeerReviews() {
        return fetchList("/api/peer-reviews", PeerReviewRow[].class, 10);
    }

    public List<ChatMessageRow> fetchChat() {
        return fetchList("/api/chat", ChatMessageRow[].class, 10);
    }

    public List<ChatNetworkRow> fetchChatNetwork() {
        return fetchList("/api/chat-network", ChatNetworkRow[].class, 10);
    }

    public List<SubmissionRow> fetchSubmissions() {
        return fetchList("/api/submissions", SubmissionRow[].class, 10);
    }

    public List<RescueRow> fetchRescues() {
        return fetchList("/api/rescues", RescueRow[].class, 10);
    }

    public MetaRow fetchMeta() {
        try {
            return client.get().uri("/api/meta")
                    .retrieve().bodyToMono(MetaRow.class)
                    .timeout(Duration.ofSeconds(10)).block();
        } catch (WebClientResponseException e) {
            throw new AiDataException("FastAPI " + e.getStatusCode() + " for /api/meta", e);
        } catch (RuntimeException e) {
            throw new AiDataException("FastAPI request failed: /api/meta", e);
        }
    }

    public AnalyzeResult analyze(Resource file, String text, String url,
                                 String task, String title, String role, Integer n) {
        MultipartBodyBuilder builder = new MultipartBodyBuilder();
        if (file != null) builder.part("file", file);
        if (text != null) builder.part("text", text);
        if (url != null) builder.part("url", url);
        if (task != null) builder.part("task", task);
        if (title != null) builder.part("title", title);
        if (role != null) builder.part("role", role);
        if (n != null) builder.part("n", n.toString());

        try {
            return client.post().uri("/api/analyze")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .bodyValue(builder.build())
                    .retrieve()
                    .bodyToMono(AnalyzeResult.class)
                    .timeout(Duration.ofSeconds(60))
                    .block();
        } catch (WebClientResponseException e) {
            throw new AiDataException("FastAPI " + e.getStatusCode() + " for /api/analyze", e);
        } catch (RuntimeException e) {
            throw new AiDataException("FastAPI request failed: /api/analyze", e);
        }
    }

    // ─────────────────── DTOs ───────────────────

    @Getter
    public static class TemperatureRow {
        @JsonProperty("member_id") private String memberId;
        private String name;
        private String role;
        @JsonProperty("온도") private Double temperature;
        @JsonProperty("기여") private Double contribution;
        @JsonProperty("소통") private Double communication;
        @JsonProperty("진행관리") private Double management;
        @JsonProperty("품질") private Double quality;
        @JsonProperty("역량") private Double competency;
        @JsonProperty("받은기여도") private Double contributionScore;
        @JsonProperty("구원") private Integer rescueCount;
        @JsonProperty("결손") private Double deficit;
        @JsonProperty("무임승차") private Boolean freeRider;
        // live 전용
        private Map<String, Object> evidence;
    }

    @Getter
    public static class MemberRow {
        @JsonProperty("member_id") private String memberId;
        private String name;
        private String role;
    }

    @Getter
    public static class PeerReviewRow {
        @JsonProperty("rater_id") private String raterId;
        @JsonProperty("ratee_id") private String rateeId;
        @JsonProperty("contribution_pct") private Double contributionPct;
        @JsonProperty("score_기여") private Integer scoreContribution;
        @JsonProperty("score_소통") private Integer scoreCommunication;
        @JsonProperty("score_진행관리") private Integer scoreManagement;
        @JsonProperty("score_품질") private Integer scoreQuality;
        @JsonProperty("score_역량") private Integer scoreCompetency;
        @JsonProperty("comment_text") private String commentText;
        @JsonProperty("llmcomment_기여") private Integer llmContribution;
        @JsonProperty("llmcomment_소통") private Integer llmCommunication;
        @JsonProperty("llmcomment_진행관리") private Integer llmManagement;
        @JsonProperty("llmcomment_품질") private Integer llmQuality;
        @JsonProperty("llmcomment_역량") private Integer llmCompetency;
    }

    @Getter
    public static class ChatMessageRow {
        @JsonProperty("message_id") private String messageId;
        @JsonProperty("thread_id") private String threadId;
        @JsonProperty("member_id") private String memberId;
        private String name;
        private String ts;
        private String text;
        @JsonProperty("gt_reply_to") private String gtReplyTo;
        @JsonProperty("response_latency_min") private Double responseLatencyMin;
        @JsonProperty("llm_reply_to") private String llmReplyTo;
        @JsonProperty("llm_category") private String llmCategory;
    }

    @Getter
    public static class ChatNetworkRow {
        @JsonProperty("member_id") private String memberId;
        private String name;
        @JsonProperty("발화수") private Integer utteranceCount;
        @JsonProperty("응답함_out") private Integer responseOut;
        @JsonProperty("응답받음_in") private Integer responseIn;
        private Double pagerank;
        @JsonProperty("상호작용") private Integer interaction;
        @JsonProperty("중심성") private Double centrality;
        @JsonProperty("주변성") private Double peripherality;
    }

    @Getter
    public static class SubmissionRow {
        @JsonProperty("member_id") private String memberId;
        @JsonProperty("task_id") private String taskId;
        private String owner;
        @JsonProperty("doc_type") private String docType;
        private String deadline;
        @JsonProperty("submitted_at") private String submittedAt;
        private Boolean rejected;
        @JsonProperty("doc_text") private String docText;
        @JsonProperty("llm_doc_quality") private Integer llmDocQuality;
    }

    @Getter
    public static class RescueRow {
        @JsonProperty("task_id") private String taskId;
        private String owner;
        private String rescuer;
        @JsonProperty("owner_id") private String ownerId;
        @JsonProperty("rescuer_id") private String rescuerId;
        private String reason;
    }

    @Getter
    public static class MetaRow {
        @JsonProperty("project_start") private String projectStart;
        @JsonProperty("project_end") private String projectEnd;
        @JsonProperty("review_date") private String reviewDate;
        private Map<String, String> deadlines;
    }

    @Getter
    public static class AnalyzeResult {
        private String source;
        private String kind;
        private String fmt;
        @JsonProperty("char_len") private Integer charLen;
        private List<String> warnings;
        private Map<String, Object> classification;
        private Map<String, Object> structure;
        private AnalyzeScores scores;
        private Map<String, Object> verification;

        @Getter
        public static class AnalyzeScores {
            private Integer overall;
            private Map<String, Integer> criteria;
            private Map<String, Object> evidence;
            private String reasoning;
        }
    }

    public static class AiDataException extends RuntimeException {
        public AiDataException(String message) { super(message); }
        public AiDataException(String message, Throwable cause) { super(message, cause); }
    }
}
