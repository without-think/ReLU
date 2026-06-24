package com.smartsejong.api.domain.group.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
public class CreateGroupRequest {
    private String name;
    private String description;
    private String githubRepoUrl;
    private LocalDateTime projectDeadline;
    private String ecampusCourseId;
    private String courseName;
    private String professor;
}
