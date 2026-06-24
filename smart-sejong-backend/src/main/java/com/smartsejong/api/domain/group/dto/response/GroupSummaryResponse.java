package com.smartsejong.api.domain.group.dto.response;

import com.smartsejong.api.domain.group.entity.Group;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class GroupSummaryResponse {
    private final Long id;
    private final String name;
    private final String description;
    private final String inviteCode;
    private final String githubRepoUrl;
    private final LocalDateTime projectDeadline;
    private final String ecampusCourseId;
    private final String courseName;
    private final String professor;
    private final int memberCount;
    private final boolean joined;

    public GroupSummaryResponse(Group group, int memberCount) {
        this(group, memberCount, true);
    }

    public GroupSummaryResponse(Group group, int memberCount, boolean joined) {
        this.id = group.getId();
        this.name = group.getName();
        this.description = group.getDescription();
        this.inviteCode = group.getInviteCode();
        this.githubRepoUrl = group.getGithubRepoUrl();
        this.projectDeadline = group.getProjectDeadline();
        this.ecampusCourseId = group.getEcampusCourseId();
        this.courseName = group.getCourseName();
        this.professor = group.getProfessor();
        this.memberCount = memberCount;
        this.joined = joined;
    }
}
