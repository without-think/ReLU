package com.smartsejong.api.domain.group.dto.request;

import com.smartsejong.api.domain.group.entity.MemberRole;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class AssignRoleRequest {
    private MemberRole role;
}
