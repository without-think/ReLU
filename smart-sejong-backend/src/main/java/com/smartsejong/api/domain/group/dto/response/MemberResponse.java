package com.smartsejong.api.domain.group.dto.response;

import com.smartsejong.api.domain.group.entity.GroupMember;
import com.smartsejong.api.domain.group.entity.MemberRole;
import lombok.Getter;

@Getter
public class MemberResponse {
    private final Long memberId;
    private final Long userId;
    private final String name;
    private final String studentId;
    private final String major;
    private final MemberRole role;
    private final double temperature;
    private final boolean preferenceReady;
    private final String additionalRoles;

    // Preference
    private final MemberRole preferredRole;
    private final boolean leadershipWilling;
    private final boolean prConfident;

    private final int skillBackend;
    private final int skillFrontend;
    private final int skillAI;
    private final int skillResearch;
    private final int skillPresent;

    // Self-rating (accumulated from peer reviews, not self-input)
    private final int selfContributing;
    private final int selfInteracting;
    private final int selfKeepingOnTrack;
    private final int selfExpectingQuality;
    private final int selfKnowledgeSkills;

    public MemberResponse(GroupMember gm) {
        this.memberId = gm.getId();
        this.userId = gm.getUser().getId();
        this.name = gm.getUser().getFullName();
        this.studentId = gm.getUser().getStudentId();
        this.major = gm.getUser().getMajor();
        this.role = gm.getRole();
        this.temperature = gm.getTemperature();
        this.preferenceReady = gm.isPreferenceReady();
        this.additionalRoles = gm.getAdditionalRoles();

        this.preferredRole = gm.getPreferredRole();
        this.leadershipWilling = gm.isLeadershipWilling();
        this.prConfident = gm.isPrConfident();

        this.skillBackend = gm.getSkillBackend();
        this.skillFrontend = gm.getSkillFrontend();
        this.skillAI = gm.getSkillAI();
        this.skillResearch = gm.getSkillResearch();
        this.skillPresent = gm.getSkillPresent();

        this.selfContributing = gm.getSelfContributing();
        this.selfInteracting = gm.getSelfInteracting();
        this.selfKeepingOnTrack = gm.getSelfKeepingOnTrack();
        this.selfExpectingQuality = gm.getSelfExpectingQuality();
        this.selfKnowledgeSkills = gm.getSelfKnowledgeSkills();
    }
}
