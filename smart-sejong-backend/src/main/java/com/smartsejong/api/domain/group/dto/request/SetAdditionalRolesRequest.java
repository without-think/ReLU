package com.smartsejong.api.domain.group.dto.request;

import com.smartsejong.api.domain.group.entity.MemberRole;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class SetAdditionalRolesRequest {
    private List<MemberRole> additionalRoles;
}
