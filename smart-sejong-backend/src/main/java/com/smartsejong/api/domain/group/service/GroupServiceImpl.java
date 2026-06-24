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

import java.time.LocalDateTime;
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
    private final GroupMessageRepository groupMessageRepository;
    private final MessageReadReceiptRepository messageReadReceiptRepository;
    private final UserRepository userRepository;
    private final FileStorageService fileStorageService;

    private static final String CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    // --- Group CRUD ---

    @Override
    @Transactional
    public CreateGroupResponse createGroup(Long userId, CreateGroupRequest request) {
        User user = getUser(userId);
        validateFutureDeadline(request.getProjectDeadline());
        String inviteCode = generateUniqueInviteCode();
        Group group = Group.builder()
                .name(request.getName())
                .description(request.getDescription())
                .githubRepoUrl(request.getGithubRepoUrl())
                .projectDeadline(request.getProjectDeadline())
                .ecampusCourseId(request.getEcampusCourseId())
                .courseName(request.getCourseName())
                .professor(request.getProfessor())
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
    public List<GroupSummaryResponse> getMyGroups(Long userId, String ecampusCourseId) {
        User user = getUser(userId);

        // 교수 계정: 담당 교수명으로 등록된 팀 전체 반환
        if (user.getRole() != null && user.getRole().name().equals("PROFESSOR")) {
            String professorName = user.getFullName();
            return groupRepository.findByProfessorContainingIgnoreCase(professorName).stream()
                    .map(group -> {
                        int count = groupMemberRepository.findByGroup(group).size();
                        return count == 0 ? null : new GroupSummaryResponse(
                                group,
                                count,
                                groupMemberRepository.existsByGroupAndUser(group, user)
                        );
                    })
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        }

        if (ecampusCourseId != null && !ecampusCourseId.isBlank()) {
            return groupRepository.findByEcampusCourseId(ecampusCourseId).stream()
                    .map(group -> {
                        int count = groupMemberRepository.findByGroup(group).size();
                        return count == 0 ? null : new GroupSummaryResponse(
                                group,
                                count,
                                groupMemberRepository.existsByGroupAndUser(group, user)
                        );
                    })
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());
        }

        List<GroupMember> memberships = groupMemberRepository.findByUser(user);
        return memberships.stream().map(gm -> {
            int count = groupMemberRepository.findByGroup(gm.getGroup()).size();
            return new GroupSummaryResponse(gm.getGroup(), count);
        })
                .collect(Collectors.toList());
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
        validateFutureDeadline(request.getProjectDeadline());
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
        assertRoleConfirmAuthority(group, getUser(requestingUserId));
        GroupMember target = groupMemberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.GROUP_NOT_FOUND));
        if (!target.getGroup().getId().equals(groupId)) {
            throw new CustomException(ErrorCode.GROUP_NOT_FOUND);
        }
        if (request.getRole() == MemberRole.LEADER) {
            groupMemberRepository.findByGroupIdWithUser(groupId).stream()
                    .filter(member -> !member.getId().equals(target.getId()))
                    .filter(member -> member.getRole() == MemberRole.LEADER)
                    .forEach(member -> member.assignRole(MemberRole.UNASSIGNED));
        }
        target.assignRole(request.getRole());
        return new MemberResponse(target);
    }

    @Override
    @Transactional
    public MemberResponse updatePreference(Long groupId, Long userId, UpdatePreferenceRequest request) {
        Group group = getGroup(groupId);
        User user = getUser(userId);
        GroupMember member = groupMemberRepository.findByGroupAndUser(group, user)
                .orElseThrow(() -> new CustomException(ErrorCode.GROUP_NOT_FOUND));
        member.updatePreference(
                request.getPreferredRole(), request.isLeadershipWilling(), request.isPrConfident(),
                request.getSkillBackend(), request.getSkillFrontend(), request.getSkillAI(),
                request.getSkillResearch(), request.getSkillPresent());
        return new MemberResponse(member);
    }

    @Override
    @Transactional
    public MemberResponse markReady(Long groupId, Long userId) {
        Group group = getGroup(groupId);
        User user = getUser(userId);
        GroupMember member = groupMemberRepository.findByGroupAndUser(group, user)
                .orElseThrow(() -> new CustomException(ErrorCode.GROUP_NOT_FOUND));
        member.markReady();
        return new MemberResponse(member);
    }

    @Override
    @Transactional
    public GroupDetailResponse confirmRoles(Long groupId, Long userId) {
        Group group = getGroup(groupId);
        assertRoleConfirmAuthority(group, getUser(userId));

        List<GroupMember> members = groupMemberRepository.findByGroupIdWithUser(groupId);
        ensureSingleLeader(group, members);
        List<MemberRole> roleSlots = Arrays.asList(
                MemberRole.BACKEND, MemberRole.FRONTEND, MemberRole.AI,
                MemberRole.RESEARCHER, MemberRole.PRESENTER);

        List<GroupMember> nonLeaders = members.stream()
                .filter(m -> m.getRole() != MemberRole.LEADER)
                .collect(Collectors.toList());

        Map<Long, List<MemberRole>> memberRoles = new LinkedHashMap<>();
        int totalMembers = members.size();
        int n = nonLeaders.size();

        if (n == 0) {
            // nothing to assign

        } else if (totalMembers == 2) {
            // 총 2인팀(리더+비리더): 비리더 3개, 리더 additionalRoles 2개 → 각자 역할 3개
            GroupMember leader = members.stream()
                    .filter(m -> m.getRole() == MemberRole.LEADER)
                    .findFirst().orElse(null);
            GroupMember nonLeader = nonLeaders.get(0);

            List<MemberRole> nonLeaderRoles = roleSlots.stream()
                    .sorted(Comparator.comparingDouble(r -> -assignmentScore(nonLeader, r)))
                    .limit(3)
                    .collect(Collectors.toList());

            List<MemberRole> leaderExtra = roleSlots.stream()
                    .filter(r -> !nonLeaderRoles.contains(r))
                    .collect(Collectors.toList()); // 항상 2개

            memberRoles.put(nonLeader.getId(), nonLeaderRoles);
            if (leader != null) memberRoles.put(leader.getId(), leaderExtra);

        } else if (n == 2) {
            // 비리더 2명(3인팀): 각자 정확히 3개, 1개 겸직(overlap)
            GroupMember first = nonLeaders.stream()
                    .max(Comparator.comparingDouble(m ->
                            roleSlots.stream().mapToDouble(r -> assignmentScore(m, r)).sum()))
                    .orElse(nonLeaders.get(0));
            GroupMember second = nonLeaders.stream()
                    .filter(m -> !m.getId().equals(first.getId()))
                    .findFirst().orElse(nonLeaders.get(1));

            List<MemberRole> firstRoles = roleSlots.stream()
                    .sorted(Comparator.comparingDouble(r -> -assignmentScore(first, r)))
                    .limit(3)
                    .collect(Collectors.toList());

            List<MemberRole> remaining = roleSlots.stream()
                    .filter(r -> !firstRoles.contains(r))
                    .collect(Collectors.toList());

            MemberRole sharedRole = firstRoles.stream()
                    .max(Comparator.comparingDouble(r -> assignmentScore(second, r)))
                    .orElse(firstRoles.get(0));

            List<MemberRole> secondRoles = new ArrayList<>(remaining);
            secondRoles.add(sharedRole);

            memberRoles.put(first.getId(), firstRoles);
            memberRoles.put(second.getId(), secondRoles);

        } else {
            // 비리더 3명 이상: 그리디, 역할당 1명, 인당 최대 3개
            record Candidate(GroupMember member, MemberRole role, double score) {}
            List<Candidate> candidates = new ArrayList<>();
            for (GroupMember m : nonLeaders) {
                for (MemberRole r : roleSlots) {
                    candidates.add(new Candidate(m, r, assignmentScore(m, r)));
                }
            }
            candidates.sort(Comparator.comparingDouble(Candidate::score).reversed());

            Set<MemberRole> filledRoles = new HashSet<>();
            for (Candidate c : candidates) {
                if (filledRoles.contains(c.role())) continue;
                List<MemberRole> assigned = memberRoles.computeIfAbsent(c.member().getId(), k -> new ArrayList<>());
                if (assigned.size() >= 3) continue;
                assigned.add(c.role());
                filledRoles.add(c.role());
            }
            for (Candidate c : candidates) {
                if (filledRoles.size() == roleSlots.size()) break;
                if (filledRoles.contains(c.role())) continue;
                memberRoles.computeIfAbsent(c.member().getId(), k -> new ArrayList<>()).add(c.role());
                filledRoles.add(c.role());
            }
        }

        // Apply to entities
        for (GroupMember m : members) {
            List<MemberRole> assigned = memberRoles.getOrDefault(m.getId(), List.of());
            if (assigned.isEmpty()) continue;

            if (m.getRole() == MemberRole.LEADER) {
                // 리더는 LEADER 역할 유지, additionalRoles만 설정
                String additional = assigned.stream()
                        .map(Enum::name).collect(Collectors.joining(","));
                m.setAdditionalRoles(additional);
            } else {
                m.assignRole(assigned.get(0));
                String additional = assigned.size() > 1
                        ? assigned.subList(1, assigned.size()).stream()
                                .map(Enum::name).collect(Collectors.joining(","))
                        : null;
                m.setAdditionalRoles(additional);
            }
        }

        group.confirmRoles();
        List<MemberResponse> memberResponses = groupMemberRepository.findByGroupIdWithUser(groupId).stream()
                .map(MemberResponse::new)
                .collect(Collectors.toList());
        return new GroupDetailResponse(group, memberResponses);
    }

    @Override
    @Transactional
    public GroupDetailResponse completeProject(Long groupId, Long userId) {
        Group group = getGroup(groupId);
        assertLeader(group, getUser(userId));
        group.completeProject();

        List<MemberResponse> memberResponses = groupMemberRepository.findByGroupIdWithUser(groupId).stream()
                .map(MemberResponse::new)
                .collect(Collectors.toList());
        return new GroupDetailResponse(group, memberResponses);
    }

    // score = preference(48) + radar avg(20) + role skill(20) + temperature bonus(2)
    private double assignmentScore(GroupMember m, MemberRole role) {
        double preference = (role == m.getPreferredRole()) ? 48.0 : 0.0;
        double radarAvg = (m.getSelfContributing() + m.getSelfInteracting()
                + m.getSelfKeepingOnTrack() + m.getSelfExpectingQuality()
                + m.getSelfKnowledgeSkills()) / 5.0;
        double radar = (radarAvg / 5.0) * 20.0;
        double skill = (skillFor(m, role) / 5.0) * 20.0;
        double temp = (m.getTemperature() / 100.0) * 2.0;
        return preference + radar + skill + temp;
    }

    @Override
    @Transactional
    public MemberResponse setAdditionalRoles(Long groupId, Long memberId, Long userId, SetAdditionalRolesRequest request) {
        Group group = getGroup(groupId);
        assertLeader(group, getUser(userId));
        GroupMember target = groupMemberRepository.findById(memberId)
                .orElseThrow(() -> new CustomException(ErrorCode.GROUP_NOT_FOUND));
        String encoded = request.getAdditionalRoles() == null ? null :
                request.getAdditionalRoles().stream()
                        .map(Enum::name)
                        .collect(Collectors.joining(","));
        target.setAdditionalRoles(encoded);
        return new MemberResponse(target);
    }

    private int skillFor(GroupMember m, MemberRole role) {
        return switch (role) {
            case BACKEND -> m.getSkillBackend();
            case FRONTEND -> m.getSkillFrontend();
            case AI -> m.getSkillAI();
            case RESEARCHER -> m.getSkillResearch();
            case PRESENTER -> m.getSkillPresent();
            default -> 0;
        };
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

        if (!group.isProjectCompleted()) {
            throw new CustomException(ErrorCode.PROJECT_NOT_COMPLETED);
        }
        if (peerReviewRepository.existsByGroupIdAndReviewerAndReviewee(groupId, reviewer, reviewee)) {
            throw new CustomException(ErrorCode.PEER_REVIEW_ALREADY_SUBMITTED);
        }

        boolean selfReview = reviewer.getId().equals(reviewee.getId());
        int contributing = selfReview ? 3 : request.getContributing();
        int interacting = selfReview ? 3 : request.getInteracting();
        int keepingOnTrack = selfReview ? 3 : request.getKeepingOnTrack();
        int expectingQuality = selfReview ? 3 : request.getExpectingQuality();
        int knowledgeSkills = selfReview ? 3 : request.getKnowledgeSkills();
        String comment = selfReview ? null : request.getComment();

        boolean suspectedFreeRider = !selfReview && (request.getContributionScore() < 10
                || contributing <= 1
                || interacting <= 1);

        PeerReview review = PeerReview.builder()
                .group(group).reviewer(reviewer).reviewee(reviewee)
                .contributionScore(request.getContributionScore())
                .contributing(contributing)
                .interacting(interacting)
                .keepingOnTrack(keepingOnTrack)
                .expectingQuality(expectingQuality)
                .knowledgeSkills(knowledgeSkills)
                .comment(comment)
                .suspectedFreeRider(suspectedFreeRider)
                .build();
        peerReviewRepository.save(review);

        if (!selfReview) {
            double avgScore = (contributing + interacting + keepingOnTrack + expectingQuality + knowledgeSkills) / 5.0;
            double delta = (avgScore - 3.0) * 0.2; // neutral=3 -> 0 delta
            GroupMember member = groupMemberRepository.findByGroupAndUser(group, reviewee).orElse(null);
            if (member != null) {
                member.adjustTemperature(delta);
            }
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

        List<PeerReviewSummaryResponse.ReviewCommentDto> comments = allReviews.stream()
                .filter(review -> review.getComment() != null && !review.getComment().isBlank())
                .map(review -> new PeerReviewSummaryResponse.ReviewCommentDto(
                        review.getReviewer().getId(),
                        review.getReviewer().getFullName(),
                        review.getReviewee().getId(),
                        review.getReviewee().getFullName(),
                        review.getContributionScore(),
                        review.getContributing(),
                        review.getInteracting(),
                        review.getKeepingOnTrack(),
                        review.getExpectingQuality(),
                        review.getKnowledgeSkills(),
                        review.getComment(),
                        review.getCreatedAt()
                ))
                .collect(Collectors.toList());

        List<PeerReviewSummaryResponse.SubmittedReviewDto> submittedReviews = allReviews.stream()
                .map(review -> new PeerReviewSummaryResponse.SubmittedReviewDto(
                        review.getReviewer().getId(),
                        review.getReviewee().getId()
                ))
                .collect(Collectors.toList());

        return new PeerReviewSummaryResponse(scores, comments, submittedReviews);
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

    private void validateFutureDeadline(LocalDateTime projectDeadline) {
        if (projectDeadline == null || !projectDeadline.isAfter(LocalDateTime.now())) {
            throw new CustomException(ErrorCode.PROJECT_DEADLINE_REQUIRED);
        }
    }

    private void assertMember(Group group, User user) {
        if (user.getRole() == com.smartsejong.api.common.enums.UserRole.PROFESSOR) return;
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

    // --- Chat ---

    @Override
    public List<MessageResponse> getMessages(Long groupId, Long userId, int page, int size) {
        Group group = getGroup(groupId);
        User user = getUser(userId);
        assertMember(group, user);

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        List<MessageResponse> messages = groupMessageRepository.findByGroupIdOrderByCreatedAtDesc(groupId, pageable)
                .getContent()
                .stream()
                .map(MessageResponse::new)
                .collect(java.util.stream.Collectors.toList());

        // DESC로 가져온 결과를 역순으로 뒤집어서 오래된 메시지가 위에, 최신 메시지가 아래에 오도록 함
        java.util.Collections.reverse(messages);
        return messages;
    }

    @Override
    @Transactional
    public MessageResponse sendMessage(Long groupId, Long userId, SendMessageRequest request) {
        Group group = getGroup(groupId);
        User user = getUser(userId);
        assertMember(group, user);

        // 답장 대상 메시지 조회
        GroupMessage replyTo = null;
        if (request.getReplyToId() != null) {
            replyTo = groupMessageRepository.findById(request.getReplyToId())
                    .orElse(null);
        }

        // 언급된 사용자 ID를 문자열로 변환
        String mentionedUserIdsStr = null;
        if (request.getMentionedUserIds() != null && !request.getMentionedUserIds().isEmpty()) {
            mentionedUserIdsStr = request.getMentionedUserIds().stream()
                    .map(String::valueOf)
                    .collect(Collectors.joining(","));
        }

        GroupMessage message = GroupMessage.builder()
                .group(group)
                .sender(user)
                .content(request.getContent())
                .replyTo(replyTo)
                .mentionedUserIds(mentionedUserIdsStr)
                .build();
        groupMessageRepository.save(message);

        return new MessageResponse(message);
    }

    @Override
    @Transactional
    public void deleteMessage(Long messageId, Long userId) {
        GroupMessage message = groupMessageRepository.findById(messageId)
                .orElseThrow(() -> new CustomException(ErrorCode.INVALID_INPUT_VALUE));

        User user = getUser(userId);

        // 본인 메시지만 삭제 가능 (교수는 예외)
        if (user.getRole() != com.smartsejong.api.common.enums.UserRole.PROFESSOR
                && !message.getSender().getId().equals(userId)) {
            throw new CustomException(ErrorCode.INVALID_INPUT_VALUE);
        }

        message.markDeleted();
    }

    @Override
    @Transactional
    public void markAsRead(Long groupId, Long userId, Long messageId) {
        Group group = getGroup(groupId);
        User user = getUser(userId);
        assertMember(group, user);

        MessageReadReceipt receipt = messageReadReceiptRepository
                .findByGroupIdAndUserId(groupId, userId)
                .orElseGet(() -> MessageReadReceipt.builder()
                        .group(group)
                        .user(user)
                        .lastReadMessageId(messageId)
                        .build());

        receipt.updateLastReadMessageId(messageId);
        messageReadReceiptRepository.save(receipt);
    }

    @Override
    public ReadReceiptResponse getReadReceipts(Long groupId) {
        List<Object[]> results = messageReadReceiptRepository.findReadStatusByGroupId(groupId);
        Map<Long, Long> readStatus = results.stream()
                .collect(Collectors.toMap(
                        r -> (Long) r[0],
                        r -> r[1] != null ? (Long) r[1] : 0L
                ));
        return new ReadReceiptResponse(readStatus);
    }

    private void assertRoleConfirmAuthority(Group group, User user) {
        if (group.isRolesConfirmed()) {
            assertLeader(group, user);
            return;
        }
        if (group.getCreatedBy() == null || !group.getCreatedBy().getId().equals(user.getId())) {
            throw new CustomException(ErrorCode.INVALID_INPUT_VALUE);
        }
    }

    private void ensureSingleLeader(Group group, List<GroupMember> members) {
        GroupMember leader = members.stream()
                .filter(member -> member.getRole() == MemberRole.LEADER)
                .findFirst()
                .orElseGet(() -> members.stream()
                        .filter(member -> group.getCreatedBy() != null
                                && member.getUser().getId().equals(group.getCreatedBy().getId()))
                        .findFirst()
                        .orElse(members.isEmpty() ? null : members.get(0)));

        if (leader == null) {
            return;
        }

        leader.assignRole(MemberRole.LEADER);
        members.stream()
                .filter(member -> !member.getId().equals(leader.getId()))
                .filter(member -> member.getRole() == MemberRole.LEADER)
                .forEach(member -> member.assignRole(MemberRole.UNASSIGNED));
    }
}
