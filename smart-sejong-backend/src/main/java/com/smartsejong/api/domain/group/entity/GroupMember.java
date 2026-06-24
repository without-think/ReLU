package com.smartsejong.api.domain.group.entity;

import com.smartsejong.api.common.entity.BaseTimeEntity;
import com.smartsejong.api.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "group_members")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GroupMember extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private MemberRole role = MemberRole.UNASSIGNED;

    @Column(nullable = false)
    private double temperature = 36.5;

    // ── Preference fields ──────────────────────────────────────
    @Enumerated(EnumType.STRING)
    private MemberRole preferredRole;

    @Column(nullable = false)
    private boolean preferenceReady = false;

    @Column
    private String additionalRoles; // comma-separated MemberRole names

    @Column(nullable = false)
    private boolean leadershipWilling = false;

    @Column(nullable = false)
    private boolean prConfident = false;

    // Part skill levels (1–5)
    @Column(nullable = false) private int skillBackend = 3;
    @Column(nullable = false) private int skillFrontend = 3;
    @Column(nullable = false) private int skillAI = 3;
    @Column(nullable = false) private int skillResearch = 3;
    @Column(nullable = false) private int skillPresent = 3;

    // Self-rated 5 dimensions (1–5)
    @Column(nullable = false) private int selfContributing = 3;
    @Column(nullable = false) private int selfInteracting = 3;
    @Column(nullable = false) private int selfKeepingOnTrack = 3;
    @Column(nullable = false) private int selfExpectingQuality = 3;
    @Column(nullable = false) private int selfKnowledgeSkills = 3;

    @Builder
    public GroupMember(Group group, User user) {
        this.group = group;
        this.user = user;
        this.role = MemberRole.UNASSIGNED;
        this.temperature = 36.5;
    }

    public void assignRole(MemberRole role) {
        this.role = role;
    }

    public void adjustTemperature(double delta) {
        this.temperature = Math.max(0, Math.min(100, this.temperature + delta));
    }

    public void updatePreference(
            MemberRole preferredRole, boolean leadershipWilling, boolean prConfident,
            int skillBackend, int skillFrontend, int skillAI, int skillResearch, int skillPresent) {
        this.preferredRole = preferredRole;
        this.leadershipWilling = leadershipWilling;
        this.prConfident = prConfident;
        this.skillBackend = skillBackend;
        this.skillFrontend = skillFrontend;
        this.skillAI = skillAI;
        this.skillResearch = skillResearch;
        this.skillPresent = skillPresent;
    }

    public void markReady() {
        this.preferenceReady = true;
    }

    public void setAdditionalRoles(String additionalRoles) {
        this.additionalRoles = additionalRoles;
    }
}