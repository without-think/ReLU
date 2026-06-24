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

    public MemberResponse(GroupMember gm) {
        this.memberId = gm.getId();
        this.userId = gm.getUser().getId();
        this.name = gm.getUser().getFullName();
        this.studentId = gm.getUser().getStudentId();
        this.major = gm.getUser().getMajor();
        this.role = gm.getRole();
        this.temperature = gm.getTemperature();
    }
}
