package com.smartsejong.api.domain.group.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class CreateGroupResponse {
    private Long groupId;
    private String inviteCode;
}
