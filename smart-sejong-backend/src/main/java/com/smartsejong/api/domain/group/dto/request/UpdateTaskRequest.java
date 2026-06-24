package com.smartsejong.api.domain.group.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
public class UpdateTaskRequest {
    private String title;
    private String description;
    private Long assigneeId;
    private LocalDateTime startDate;
    private LocalDateTime deadline;
    private Integer progress;
}
