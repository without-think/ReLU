package com.smartsejong.api.domain.group.service;

import com.smartsejong.api.domain.group.dto.request.*;
import com.smartsejong.api.domain.group.dto.response.*;
import com.smartsejong.api.domain.group.entity.*;
import com.smartsejong.api.domain.group.repository.*;
import com.smartsejong.api.domain.user.entity.User;
import com.smartsejong.api.domain.user.repository.UserRepository;
import com.smartsejong.api.exception.CustomException;
import com.smartsejong.api.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class GroupServiceImpl implements GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final AvailabilityRepository availabilityRepository;
    private final ProjectTaskRepository projectTaskRepository;
    private final PeerReviewRepository peerReviewRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    private static final String CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    // --- Group CRUD ---

    @Override
    @Transactional
    public CreateGroupResponse createGroup(Long userId, CreateGroupRequest request) {
        User user = getUser(userId);
        String inviteCode = generateUniqueInviteCode();
        Group group = Group.builder()
                .name(request.getName())
                .description(request.getDescription())
                .githubRepoUrl(request.getGithubRepoUrl())
                .projectDeadline(request.getProjectDeadline())
                .inviteCode(inviteCode)
                .createdBy(user)
                .build();
        groupRepository.save(group);

        GroupMember member = GroupMember.builder().group(group).user(user).build();
        member.assignRole(MemberRole.LEADER);
        groupMemberRepository.save(member);

        return new CreateGroupResponse(group.getId(), inviteCode);
    }

    @Override
    public List<GroupSummaryResponse> getMyGroups(Long userId) {
        User user = getUser(userId);
        List<GroupMember> memberships = groupMemberRepository.findByUser(user);
        return memberships.stream().map(gm -> {
            int count = groupMemberRepository.findByGroup(gm.getGroup()).size();
            return new GroupSummaryResponse(gm.getGroup(), count);
        }).collect(Collectors.toList());
    }

    @Override
    public GroupDetailResponse getGroupDetail(Long groupId, Long userId) {
        Group group = getGroup(groupId);
        assertMember(group, getUser(userId));
        List<GroupMember> members = groupMemberRepository.findByGroupIdWithUser(groupId);
        List<MemberResponse> memberResponses = members.stream()
                .map(MemberResponse::new)
                .collect(Collectors.toList());
        return new GroupDetailResponse(group, memberResponses);
    }

    @Override
    @Transactional
    public void updateGroup(Long groupId, Long userId, UpdateGroupRequest request) {
        Group group = getGroup(groupId);
        assertLeader(group, getUser(userId));
        group.updateSettings(request.getName(), request.getDescription(),
                request.getGithubRepoUrl(), request.getProjectDeadline());
    }

    @Override
    @Transactional
    public void joinGroup(Long userId, JoinGroupRequest request) {
        User user = getUser(userId);
        Group group = groupRepository.findByInviteCode(request.getInviteCode())
                .orElseThrow(() -> new CustomException(ErrorCode.GROUP_NOT_FOUND));
        if (groupMemberRepository.existsByGroupAndUser(group, user)) {
            throw new CustomException(ErrorCode.ALREADY_GROUP_MEMBER);
        }
        groupMemberRepository.save(GroupMember.builder().group(group).user(user).build());
    }

    @Override
    @Transactional
    public void leaveGroup(Long groupId, Long userId) {
        Group group = getGroup(groupId);
        User user = getUser(userId);
        GroupMember member = groupMemberRepository.findByGroupAndUser(group, user)
                .orElseThrow(() -> new CustomException(ErrorCode.GROUP_NOT_FOUND));
        groupMemberRepository.delete(member);
        availabilityRepository.deleteByGroupAndUser(group, user);
    }

    // --- Availability (When2meet) ---

    @Override
    @Transactional
    public void setAvailability(Long groupId, Long userId, SetAvailabilityRequest request) {
        Group group = getGroup(groupId);
        User user = getUser(userId);
        assertMember(group, user);
        availabilityRepository.deleteByGroupAndUser(group, user);
        if (request.getSlots() != null) {
            List<Availability> slots = request.getSlots().stream()
                    .map(s -> Availability.builder()
                            .group(group).user(user)
                            .dayOfWeek(s.getDayOfWeek()).slot(s.getSlot())
                            .build())
                    .collect(Collectors.toList());
            availabilityRepository.saveAll(slots);
        }
    }

    @Override
    public AvailabilityResponse getAvailability(Long groupId) {
        getGroup(groupId);
        List<Availability> all = availabilityRepository.findByGroupIdWithUser(groupId);

        Map<Long, List<AvailabilityResponse.SlotDto>> memberSlots = new HashMap<>();
        Map<String, Integer> heatmap = new HashMap<>();

        for (Availability a : all) {
            Long uid = a.getUser().getId();
            memberSlots.computeIfAbsent(uid, k -> new ArrayList<>())
                    .add(new AvailabilityResponse.SlotDto(a.getDayOfWeek(), a.getSlot()));
            String key = a.getDayOfWeek() + "_" + a.getSlot();
            heatmap.merge(key, 1, Integer::sum);
        }

        return new AvailabilityResponse(memberSlots, heatmap);
    }

    // --- Roles ---

    @Override
    @Transactional
    public MemberResponse assignRole(Long groupId, Long memberId, Long requestingUserId, AssignRoleRequest request) {
        Group group = getGroup(groupId);
        assertLeader(group, getUser(requestingUserId));
        GroupMember target = groupMemberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.GROUP_NOT_FOUND));
        target.assignRole(request.getRole());
        return new MemberResponse(target);
    }

    @Override
    public List<MemberResponse> getMembers(Long groupId) {
        getGroup(groupId);
        return groupMemberRepository.findByGroupIdWithUser(groupId).stream()
                .map(MemberResponse::new)
                .collect(Collectors.toList());
    }

    // --- Tasks ---

    @Override
    @Transactional
    public TaskResponse createTask(Long groupId, Long userId, CreateTaskRequest request) {
        Group group = getGroup(groupId);
        User creator = getUser(userId);
        assertMember(group, creator);

        User assignee = null;
        if (request.getAssigneeId() != null) {
            assignee = getUser(request.getAssigneeId());
        }

        ProjectTask task = ProjectTask.builder()
                .group(group)
                .assignee(assignee)
                .createdBy(creator)
                .title(request.getTitle())
                .description(request.getDescription())
                .startDate(request.getStartDate())
                .deadline(request.getDeadline())
                .build();
        projectTaskRepository.save(task);
        return new TaskResponse(task);
    }

    @Override
    public List<TaskResponse> getTasks(Long groupId) {
        getGroup(groupId);
        return projectTaskRepository.findByGroupIdOrderByDeadline(groupId).stream()
                .map(TaskResponse::new)
                .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public TaskResponse submitTask(Long taskId, Long userId, org.springframework.web.multipart.MultipartFile file) {
        ProjectTask task = projectTaskRepository.findById(taskId)
                .orElseThrow(() -> new CustomException(ErrorCode.TASK_NOT_FOUND));
        User user = getUser(userId);
        if (task.getAssignee() == null || !task.getAssignee().getId().equals(user.getId())) {
            throw new CustomException(ErrorCode.INVALID_INPUT_VALUE);
        }

        String fileName = null;
        String fileUrl = null;
        if (file != null && !file.isEmpty()) {
            String storedName = fileStorageService.store(file);
            fileName = fileStorageService.getOriginalName(file);
            fileUrl = "/api/groups/tasks/files/" + storedName;
        }
        task.submit(fileName, fileUrl);

        // Temperature adjustment: on-time +0.3, late -0.5
        GroupMember member = groupMemberRepository.findByGroupAndUser(task.getGroup(), user).orElse(null);
        if (member != null) {
            double delta = task.getStatus() == TaskStatus.LATE ? -0.5 : 0.3;
            member.adjustTemperature(delta);
        }
        return new TaskResponse(task);
    }

    @Override
    @Transactional
    public TaskResponse updateTaskStatus(Long taskId, Long userId, UpdateTaskStatusRequest request) {
        ProjectTask task = projectTaskRepository.findById(taskId)
                .orElseThrow(() -> new CustomException(ErrorCode.TASK_NOT_FOUND));
        assertLeader(task.getGroup(), getUser(userId));
        task.updateStatus(request.getStatus());
        return new TaskResponse(task);
    }

    @Override
    @Transactional
    public TaskResponse updateTask(Long taskId, Long userId, UpdateTaskRequest request) {
        ProjectTask task = projectTaskRepository.findById(taskId)
                .orElseThrow(() -> new CustomException(ErrorCode.TASK_NOT_FOUND));
        User user = getUser(userId);
        assertMember(task.getGroup(), user);

        User assignee = null;
        if (request.getAssigneeId() != null) {
            assignee = getUser(request.getAssigneeId());
        }

        task.update(
                request.getTitle(),
                request.getDescription(),
                assignee,
                request.getStartDate(),
                request.getDeadline(),
                request.getProgress()
        );
        return new TaskResponse(task);
    }

    @Override
    @Transactional
    public void deleteTask(Long taskId, Long userId) {
        ProjectTask task = projectTaskRepository.findById(taskId)
                .orElseThrow(() -> new CustomException(ErrorCode.TASK_NOT_FOUND));
        User user = getUser(userId);
        assertMember(task.getGroup(), user);
        projectTaskRepository.delete(task);
    }

    @Override
    @Transactional
    public TaskResponse updateTaskProgress(Long taskId, Long userId, Integer progress) {
        ProjectTask task = projectTaskRepository.findById(taskId)
                .orElseThrow(() -> new CustomException(ErrorCode.TASK_NOT_FOUND));
        User user = getUser(userId);
        assertMember(task.getGroup(), user);
        task.updateProgress(progress);
        return new TaskResponse(task);
    }

    @Override
    @Transactional
    public TaskResponse updateTaskDates(Long taskId, Long userId, java.time.LocalDateTime startDate, java.time.LocalDateTime deadline) {
        ProjectTask task = projectTaskRepository.findById(taskId)
                .orElseThrow(() -> new CustomException(ErrorCode.TASK_NOT_FOUND));
        User user = getUser(userId);
        assertMember(task.getGroup(), user);
        task.updateDates(startDate, deadline);
        return new TaskResponse(task);
    }

    // --- Peer Reviews ---

    @Override
    @Transactional
    public void submitPeerReview(Long groupId, Long userId, SubmitPeerReviewRequest request) {
        Group group = getGroup(groupId);
        User reviewer = getUser(userId);
        User reviewee = getUser(request.getRevieweeId());
        assertMember(group, reviewer);
        assertMember(group, reviewee);

        if (reviewer.getId().equals(reviewee.getId())) {
            throw new CustomException(ErrorCode.INVALID_INPUT_VALUE);
        }
        if (peerReviewRepository.existsByGroupIdAndReviewerAndReviewee(groupId, reviewer, reviewee)) {
            throw new CustomException(ErrorCode.PEER_REVIEW_ALREADY_SUBMITTED);
        }

        boolean suspectedFreeRider = request.getContributionScore() < 10
                || request.getContributing() <= 1
                || request.getInteracting() <= 1;

        PeerReview review = PeerReview.builder()
                .group(group).reviewer(reviewer).reviewee(reviewee)
                .contributionScore(request.getContributionScore())
                .contributing(request.getContributing())
                .interacting(request.getInteracting())
                .keepingOnTrack(request.getKeepingOnTrack())
                .expectingQuality(request.getExpectingQuality())
                .knowledgeSkills(request.getKnowledgeSkills())
                .comment(request.getComment())
                .suspectedFreeRider(suspectedFreeRider)
                .build();
        peerReviewRepository.save(review);

        // Adjust temperature based on avg score
        double avgScore = (request.getContributing() + request.getInteracting()
                + request.getKeepingOnTrack() + request.getExpectingQuality()
                + request.getKnowledgeSkills()) / 5.0;
        double delta = (avgScore - 3.0) * 0.2; // neutral=3 -> 0 delta
        GroupMember member = groupMemberRepository.findByGroupAndUser(group, reviewee).orElse(null);
        if (member != null) {
            member.adjustTemperature(delta);
        }
    }

    @Override
    public PeerReviewSummaryResponse getPeerReviewSummary(Long groupId) {
        getGroup(groupId);
        List<GroupMember> members = groupMemberRepository.findByGroupIdWithUser(groupId);
        List<PeerReview> allReviews = peerReviewRepository.findByGroupIdWithUsers(groupId);

        List<PeerReviewSummaryResponse.MemberScoreDto> scores = members.stream().map(gm -> {
            List<PeerReview> received = allReviews.stream()
                    .filter(r -> r.getReviewee().getId().equals(gm.getUser().getId()))
                    .collect(Collectors.toList());

            if (received.isEmpty()) {
                return new PeerReviewSummaryResponse.MemberScoreDto(
                        gm.getUser().getId(), gm.getUser().getFullName(),
                        0, 0, 0, 0, 0, 0, 0, false, 0);
            }

            double avgContrib = received.stream().mapToInt(PeerReview::getContributionScore).average().orElse(0);
            double avgCont = received.stream().mapToInt(PeerReview::getContributing).average().orElse(0);
            double avgInter = received.stream().mapToInt(PeerReview::getInteracting).average().orElse(0);
            double avgKeep = received.stream().mapToInt(PeerReview::getKeepingOnTrack).average().orElse(0);
            double avgQual = received.stream().mapToInt(PeerReview::getExpectingQuality).average().orElse(0);
            double avgKnow = received.stream().mapToInt(PeerReview::getKnowledgeSkills).average().orElse(0);
            double avgScore = (avgCont + avgInter + avgKeep + avgQual + avgKnow) / 5.0;
            double tempDelta = (avgScore - 3.0) * 0.2;
            boolean freeRider = received.stream().anyMatch(PeerReview::isSuspectedFreeRider);

            return new PeerReviewSummaryResponse.MemberScoreDto(
                    gm.getUser().getId(), gm.getUser().getFullName(),
                    avgContrib, avgCont, avgInter, avgKeep, avgQual, avgKnow,
                    tempDelta, freeRider, received.size());
        }).collect(Collectors.toList());

        return new PeerReviewSummaryResponse(scores);
    }

    // --- Helpers ---

    private String generateUniqueInviteCode() {
        String code;
        do {
            code = RANDOM.ints(6, 0, CHARS.length())
                    .mapToObj(i -> String.valueOf(CHARS.charAt(i)))
                    .collect(Collectors.joining());
        } while (groupRepository.existsByInviteCode(code));
        return code;
    }

    private User getUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));
    }

    private Group getGroup(Long groupId) {
        return groupRepository.findById(groupId)
                .orElseThrow(() -> new CustomException(ErrorCode.GROUP_NOT_FOUND));
    }

    private void assertMember(Group group, User user) {
        if (!groupMemberRepository.existsByGroupAndUser(group, user)) {
            throw new CustomException(ErrorCode.GROUP_NOT_FOUND);
        }
    }

    private void assertLeader(Group group, User user) {
        GroupMember member = groupMemberRepository.findByGroupAndUser(group, user)
                .orElseThrow(() -> new CustomException(ErrorCode.GROUP_NOT_FOUND));
        if (member.getRole() != MemberRole.LEADER) {
            throw new CustomException(ErrorCode.INVALID_INPUT_VALUE);
        }
    }
}
