package com.smartsejong.api.domain.group.dto.request;

import com.smartsejong.api.domain.group.entity.MemberRole;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class UpdatePreferenceRequest {
    private MemberRole preferredRole;
    private boolean leadershipWilling;
    private boolean prConfident;

    private int skillBackend = 3;
    private int skillFrontend = 3;
    private int skillAI = 3;
    private int skillResearch = 3;
    private int skillPresent = 3;
}
