package com.smartsejong.api.domain.group.dto.response;

import com.smartsejong.api.domain.group.entity.Group;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
public class GroupDetailResponse {
    private final Long id;
    private final String name;
    private final String description;
    private final String inviteCode;
    private final String githubRepoUrl;
    private final LocalDateTime projectDeadline;
    private final String ecampusCourseId;
    private final String courseName;
    private final String professor;
    private final boolean rolesConfirmed;
    private final boolean completed;
    private final Long creatorId;
    private final List<MemberResponse> members;

    public GroupDetailResponse(Group group, List<MemberResponse> members) {
        this.id = group.getId();
        this.name = group.getName();
        this.description = group.getDescription();
        this.inviteCode = group.getInviteCode();
        this.githubRepoUrl = group.getGithubRepoUrl();
        this.projectDeadline = group.getProjectDeadline();
        this.ecampusCourseId = group.getEcampusCourseId();
        this.courseName = group.getCourseName();
        this.professor = group.getProfessor();
        this.rolesConfirmed = group.isRolesConfirmed();
        this.completed = group.isProjectCompleted();
        this.creatorId = group.getCreatedBy() != null ? group.getCreatedBy().getId() : null;
        this.members = members;
    }
}
