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
@Table(name = "groups")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Group extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false, length = 6)
    private String inviteCode;

    @Column(nullable = false)
    private String name;

    @Column(length = 500)
    private String description;

    @Column
    private String githubRepoUrl;

    @Column
    private LocalDateTime projectDeadline;

    @Column(length = 100)
    private String ecampusCourseId;

    @Column
    private String courseName;

    @Column
    private String professor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by")
    private User createdBy;

    @Column(nullable = false)
    private boolean rolesConfirmed = false;

    @Builder
    public Group(String inviteCode, String name, String description, String githubRepoUrl, LocalDateTime projectDeadline,
                 String ecampusCourseId, String courseName, String professor, User createdBy) {
        this.inviteCode = inviteCode;
        this.name = name;
        this.description = description;
        this.githubRepoUrl = githubRepoUrl;
        this.projectDeadline = projectDeadline;
        this.ecampusCourseId = ecampusCourseId;
        this.courseName = courseName;
        this.professor = professor;
        this.createdBy = createdBy;
    }

    public void confirmRoles() { this.rolesConfirmed = true; }

    public void updateSettings(String name, String description, String githubRepoUrl, LocalDateTime projectDeadline) {
        if (name != null) this.name = name;
        if (description != null) this.description = description;
        this.githubRepoUrl = githubRepoUrl;
        this.projectDeadline = projectDeadline;
    }
}
