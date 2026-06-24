package com.smartsejong.api.domain.group.controller;

import com.smartsejong.api.common.CommonResponse;
import com.smartsejong.api.domain.group.dto.request.*;
import com.smartsejong.api.domain.group.dto.response.*;
import com.smartsejong.api.domain.group.service.FileStorageService;
import com.smartsejong.api.domain.group.service.GroupService;
import com.smartsejong.api.security.CustomUserDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/groups")
@RequiredArgsConstructor
public class GroupController {

    private final GroupService groupService;
    private final FileStorageService fileStorageService;

    // --- Group CRUD ---

    @PostMapping
    public CommonResponse<CreateGroupResponse> createGroup(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody CreateGroupRequest request) {
        return CommonResponse.success(groupService.createGroup(userDetails.getUserId(), request));
    }

    @GetMapping
    public CommonResponse<List<GroupSummaryResponse>> getMyGroups(
            @AuthenticationPrincipal CustomUserDetails userDetails) {
        return CommonResponse.success(groupService.getMyGroups(userDetails.getUserId()));
    }

    @GetMapping("/{groupId}")
    public CommonResponse<GroupDetailResponse> getGroupDetail(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long groupId) {
        return CommonResponse.success(groupService.getGroupDetail(groupId, userDetails.getUserId()));
    }

    @PatchMapping("/{groupId}")
    public CommonResponse<Void> updateGroup(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long groupId,
            @RequestBody UpdateGroupRequest request) {
        groupService.updateGroup(groupId, userDetails.getUserId(), request);
        return CommonResponse.success("그룹 정보가 업데이트되었습니다.", null);
    }

    @PostMapping("/join")
    public CommonResponse<Void> joinGroup(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody JoinGroupRequest request) {
        groupService.joinGroup(userDetails.getUserId(), request);
        return CommonResponse.success("그룹에 참가했습니다.", null);
    }

    @DeleteMapping("/{groupId}/leave")
    public CommonResponse<Void> leaveGroup(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long groupId) {
        groupService.leaveGroup(groupId, userDetails.getUserId());
        return CommonResponse.success("그룹에서 나갔습니다.", null);
    }

    // --- Availability ---

    @PostMapping("/{groupId}/availability")
    public CommonResponse<Void> setAvailability(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long groupId,
            @RequestBody SetAvailabilityRequest request) {
        groupService.setAvailability(groupId, userDetails.getUserId(), request);
        return CommonResponse.success("가능 시간이 저장되었습니다.", null);
    }

    @GetMapping("/{groupId}/availability")
    public CommonResponse<AvailabilityResponse> getAvailability(
            @PathVariable Long groupId) {
        return CommonResponse.success(groupService.getAvailability(groupId));
    }

    // --- Members & Roles ---

    @GetMapping("/{groupId}/members")
    public CommonResponse<List<MemberResponse>> getMembers(
            @PathVariable Long groupId) {
        return CommonResponse.success(groupService.getMembers(groupId));
    }

    @PutMapping("/{groupId}/members/{memberId}/role")
    public CommonResponse<MemberResponse> assignRole(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long groupId,
            @PathVariable Long memberId,
            @RequestBody AssignRoleRequest request) {
        return CommonResponse.success(groupService.assignRole(groupId, memberId, userDetails.getUserId(), request));
    }

    // --- Tasks ---

    @PostMapping("/{groupId}/tasks")
    public CommonResponse<TaskResponse> createTask(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long groupId,
            @RequestBody CreateTaskRequest request) {
        return CommonResponse.success(groupService.createTask(groupId, userDetails.getUserId(), request));
    }

    @GetMapping("/{groupId}/tasks")
    public CommonResponse<List<TaskResponse>> getTasks(
            @PathVariable Long groupId) {
        return CommonResponse.success(groupService.getTasks(groupId));
    }

    @PostMapping(value = "/tasks/{taskId}/submit", consumes = {MediaType.MULTIPART_FORM_DATA_VALUE, MediaType.APPLICATION_OCTET_STREAM_VALUE, "*/*"})
    public CommonResponse<TaskResponse> submitTask(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long taskId,
            @RequestParam(value = "file", required = false) MultipartFile file) {
        return CommonResponse.success(groupService.submitTask(taskId, userDetails.getUserId(), file));
    }

    @GetMapping("/tasks/files/{fileName:.+}")
    public ResponseEntity<Resource> downloadFile(@PathVariable String fileName) {
        Resource resource = fileStorageService.load(fileName);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + resource.getFilename() + "\"")
                .body(resource);
    }

    @PatchMapping("/tasks/{taskId}/status")
    public CommonResponse<TaskResponse> updateTaskStatus(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long taskId,
            @RequestBody UpdateTaskStatusRequest request) {
        return CommonResponse.success(groupService.updateTaskStatus(taskId, userDetails.getUserId(), request));
    }

    @PutMapping("/tasks/{taskId}")
    public CommonResponse<TaskResponse> updateTask(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long taskId,
            @RequestBody UpdateTaskRequest request) {
        return CommonResponse.success(groupService.updateTask(taskId, userDetails.getUserId(), request));
    }

    @DeleteMapping("/tasks/{taskId}")
    public CommonResponse<Void> deleteTask(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long taskId) {
        groupService.deleteTask(taskId, userDetails.getUserId());
        return CommonResponse.success("과제가 삭제되었습니다.", null);
    }

    @PatchMapping("/tasks/{taskId}/progress")
    public CommonResponse<TaskResponse> updateTaskProgress(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long taskId,
            @RequestBody java.util.Map<String, Integer> request) {
        return CommonResponse.success(groupService.updateTaskProgress(taskId, userDetails.getUserId(), request.get("progress")));
    }

    @PatchMapping("/tasks/{taskId}/dates")
    public CommonResponse<TaskResponse> updateTaskDates(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long taskId,
            @RequestBody java.util.Map<String, java.time.LocalDateTime> request) {
        return CommonResponse.success(groupService.updateTaskDates(
                taskId, userDetails.getUserId(),
                request.get("startDate"),
                request.get("deadline")
        ));
    }

    // --- Peer Reviews ---

    @PostMapping("/{groupId}/reviews")
    public CommonResponse<Void> submitPeerReview(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @PathVariable Long groupId,
            @RequestBody SubmitPeerReviewRequest request) {
        groupService.submitPeerReview(groupId, userDetails.getUserId(), request);
        return CommonResponse.success("동료평가가 제출되었습니다.", null);
    }

    @GetMapping("/{groupId}/reviews")
    public CommonResponse<PeerReviewSummaryResponse> getPeerReviewSummary(
            @PathVariable Long groupId) {
        return CommonResponse.success(groupService.getPeerReviewSummary(groupId));
    }
}
