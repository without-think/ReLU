package com.smartsejong.api.domain.group.controller;

import com.smartsejong.api.common.CommonResponse;
import com.smartsejong.api.domain.group.client.AiDataClient;
import com.smartsejong.api.domain.group.client.AiDataClient.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiDataController {

    private final AiDataClient aiDataClient;

    @GetMapping("/temperature")
    public CommonResponse<List<TemperatureRow>> getTemperature() {
        return CommonResponse.success(aiDataClient.fetchTemperature());
    }

    @GetMapping("/temperature/live")
    public CommonResponse<List<TemperatureRow>> getTemperatureLive(
            @RequestParam(required = false) String as_of) {
        return CommonResponse.success(aiDataClient.fetchTemperatureLive(as_of));
    }

    @GetMapping("/members")
    public CommonResponse<List<MemberRow>> getMembers() {
        return CommonResponse.success(aiDataClient.fetchMembers());
    }

    @GetMapping("/peer-reviews")
    public CommonResponse<List<PeerReviewRow>> getPeerReviews() {
        return CommonResponse.success(aiDataClient.fetchPeerReviews());
    }

    @GetMapping("/chat")
    public CommonResponse<List<ChatMessageRow>> getChat() {
        return CommonResponse.success(aiDataClient.fetchChat());
    }

    @GetMapping("/chat-network")
    public CommonResponse<List<ChatNetworkRow>> getChatNetwork() {
        return CommonResponse.success(aiDataClient.fetchChatNetwork());
    }

    @GetMapping("/submissions")
    public CommonResponse<List<SubmissionRow>> getSubmissions() {
        return CommonResponse.success(aiDataClient.fetchSubmissions());
    }

    @GetMapping("/rescues")
    public CommonResponse<List<RescueRow>> getRescues() {
        return CommonResponse.success(aiDataClient.fetchRescues());
    }

    @GetMapping("/meta")
    public CommonResponse<MetaRow> getMeta() {
        return CommonResponse.success(aiDataClient.fetchMeta());
    }

    @PostMapping(value = "/analyze", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public CommonResponse<AnalyzeResult> analyze(
            @RequestPart(required = false) MultipartFile file,
            @RequestPart(required = false) String text,
            @RequestPart(required = false) String url,
            @RequestPart(required = false) String task,
            @RequestPart(required = false) String title,
            @RequestPart(required = false) String role,
            @RequestPart(required = false) String n) {
        org.springframework.core.io.Resource fileResource =
                file != null ? file.getResource() : null;
        Integer nInt = null;
        if (n != null && !n.isBlank()) {
            try { nInt = Integer.parseInt(n.trim()); } catch (NumberFormatException ignored) {}
        }
        return CommonResponse.success(aiDataClient.analyze(fileResource, text, url, task, title, role, nInt));
    }
}
