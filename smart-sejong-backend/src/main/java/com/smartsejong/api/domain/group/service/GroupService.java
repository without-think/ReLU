package com.smartsejong.api.domain.group.service;

import com.smartsejong.api.domain.group.dto.request.*;
import com.smartsejong.api.domain.group.dto.response.*;

import java.util.List;

public interface GroupService {
    CreateGroupResponse createGroup(Long userId, CreateGroupRequest request);
    List<GroupSummaryResponse> getMyGroups(Long userId, String ecampusCourseId);
    GroupDetailResponse getGroupDetail(Long groupId, Long userId);
    void updateGroup(Long groupId, Long userId, UpdateGroupRequest request);
    void joinGroup(Long userId, JoinGroupRequest request);
    void leaveGroup(Long groupId, Long userId);

    void setAvailability(Long groupId, Long userId, SetAvailabilityRequest request);
    AvailabilityResponse getAvailability(Long groupId);

    MemberResponse assignRole(Long groupId, Long memberId, Long requestingUserId, AssignRoleRequest request);
    MemberResponse updatePreference(Long groupId, Long userId, UpdatePreferenceRequest request);
    MemberResponse markReady(Long groupId, Long userId);
    GroupDetailResponse confirmRoles(Long groupId, Long userId);
    GroupDetailResponse completeProject(Long groupId, Long userId);
    MemberResponse setAdditionalRoles(Long groupId, Long memberId, Long userId, SetAdditionalRolesRequest request);
    List<MemberResponse> getMembers(Long groupId);

    TaskResponse createTask(Long groupId, Long userId, CreateTaskRequest request);
    List<TaskResponse> getTasks(Long groupId);
    TaskResponse submitTask(Long taskId, Long userId, org.springframework.web.multipart.MultipartFile file);
    TaskResponse updateTaskStatus(Long taskId, Long userId, UpdateTaskStatusRequest request);
    TaskResponse updateTask(Long taskId, Long userId, UpdateTaskRequest request);
    void deleteTask(Long taskId, Long userId);
    TaskResponse updateTaskProgress(Long taskId, Long userId, Integer progress);
    TaskResponse updateTaskDates(Long taskId, Long userId, java.time.LocalDateTime startDate, java.time.LocalDateTime deadline);

    void submitPeerReview(Long groupId, Long userId, SubmitPeerReviewRequest request);
    PeerReviewSummaryResponse getPeerReviewSummary(Long groupId);
    List<PeerReviewDetailResponse> getPeerReviewDetails(Long groupId);

    // Chat
    List<MessageResponse> getMessages(Long groupId, Long userId, int page, int size);
    MessageResponse sendMessage(Long groupId, Long userId, SendMessageRequest request);
    void deleteMessage(Long messageId, Long userId);

    // Read Receipts
    void markAsRead(Long groupId, Long userId, Long messageId);
    ReadReceiptResponse getReadReceipts(Long groupId);
}
