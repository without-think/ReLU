package com.smartsejong.api.domain.group.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
public class UpdateGroupRequest {
    private String name;
    private String description;
    private String githubRepoUrl;
    private LocalDateTime projectDeadline;
}
