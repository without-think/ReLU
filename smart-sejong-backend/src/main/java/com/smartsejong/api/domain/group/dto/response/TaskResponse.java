package com.smartsejong.api.domain.group.dto.response;

import com.smartsejong.api.domain.group.entity.ProjectTask;
import com.smartsejong.api.domain.group.entity.TaskStatus;
import lombok.Getter;

import java.time.LocalDateTime;

@Getter
public class TaskResponse {
    private final Long id;
    private final String title;
    private final String description;
    private final Long assigneeId;
    private final String assigneeName;
    private final Long createdById;
    private final String createdByName;
    private final LocalDateTime startDate;
    private final LocalDateTime deadline;
    private final Integer progress;
    private final LocalDateTime submittedAt;
    private final String fileName;
    private final String fileUrl;
    private final TaskStatus status;
    private final LocalDateTime createdAt;

    public TaskResponse(ProjectTask task) {
        this.id = task.getId();
        this.title = task.getTitle();
        this.description = task.getDescription();
        this.assigneeId = task.getAssignee() != null ? task.getAssignee().getId() : null;
        this.assigneeName = task.getAssignee() != null ? task.getAssignee().getFullName() : null;
        this.createdById = task.getCreatedBy().getId();
        this.createdByName = task.getCreatedBy().getFullName();
        this.startDate = task.getStartDate();
        this.deadline = task.getDeadline();
        this.progress = task.getProgress() != null ? task.getProgress() : 0;
        this.submittedAt = task.getSubmittedAt();
        this.fileName = task.getFileName();
        this.fileUrl = task.getFileUrl();
        this.status = task.getStatus();
        this.createdAt = task.getCreatedAt();
    }
}
