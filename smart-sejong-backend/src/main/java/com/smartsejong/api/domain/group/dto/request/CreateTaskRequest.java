package com.smartsejong.api.domain.group.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Getter
@NoArgsConstructor
public class CreateTaskRequest {
    private String title;
    private String description;
    private Long assigneeId;
    private LocalDateTime deadline;
}
