package com.smartsejong.api.domain.group.entity;

import com.smartsejong.api.common.entity.BaseTimeEntity;
import com.smartsejong.api.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "project_tasks")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ProjectTask extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignee_id")
    private User assignee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    @Column(nullable = false)
    private String title;

    @Column(length = 1000)
    private String description;

    @Column
    private LocalDateTime startDate;

    @Column
    private LocalDateTime deadline;

    @Column
    private Integer progress = 0;

    @Column
    private LocalDateTime submittedAt;

    @Column
    private String fileName;

    @Column
    private String fileUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TaskStatus status = TaskStatus.PENDING;

    @Builder
    public ProjectTask(Group group, User assignee, User createdBy, String title, String description, LocalDateTime startDate, LocalDateTime deadline) {
        this.group = group;
        this.assignee = assignee;
        this.createdBy = createdBy;
        this.title = title;
        this.description = description;
        this.startDate = startDate;
        this.deadline = deadline;
        this.progress = 0;
        this.status = TaskStatus.PENDING;
    }

    public void submit(String fileName, String fileUrl) {
        this.submittedAt = LocalDateTime.now();
        this.fileName = fileName;
        this.fileUrl = fileUrl;
        this.status = (deadline != null && this.submittedAt.isAfter(deadline))
                ? TaskStatus.LATE
                : TaskStatus.SUBMITTED;
    }

    public void updateStatus(TaskStatus status) {
        this.status = status;
    }

    public void update(String title, String description, User assignee, LocalDateTime startDate, LocalDateTime deadline, Integer progress) {
        this.title = title;
        this.description = description;
        this.assignee = assignee;
        this.startDate = startDate;
        this.deadline = deadline;
        if (progress != null) {
            this.progress = Math.max(0, Math.min(100, progress));
        }
    }

    public void updateProgress(Integer progress) {
        this.progress = Math.max(0, Math.min(100, progress));
    }

    public void updateDates(LocalDateTime startDate, LocalDateTime deadline) {
        this.startDate = startDate;
        this.deadline = deadline;
    }
}
