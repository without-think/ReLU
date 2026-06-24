package com.smartsejong.api.domain.ecampus.dto;

import lombok.Builder;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
@Builder
public class EcampusAssignmentInfo {
    private final String assignmentId;
    private final String title;
    private final LocalDateTime deadline;
    private final LocalDateTime submittedAt;
    private final boolean submitted;
}
