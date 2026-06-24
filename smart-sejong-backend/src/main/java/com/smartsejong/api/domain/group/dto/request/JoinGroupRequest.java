package com.smartsejong.api.domain.group.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class JoinGroupRequest {
    private String inviteCode;
}
