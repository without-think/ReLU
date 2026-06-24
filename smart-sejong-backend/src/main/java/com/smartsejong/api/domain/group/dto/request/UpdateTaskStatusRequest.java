package com.smartsejong.api.domain.group.dto.request;

import com.smartsejong.api.domain.group.entity.TaskStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdateTaskStatusRequest {
    private TaskStatus status;
}
