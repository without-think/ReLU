package com.smartsejong.api.common.enums;

import lombok.Getter;
import lombok.RequiredArgsConstructor;

@Getter
@RequiredArgsConstructor
public enum UserRole {
    STUDENT("학생"),
    PROFESSOR("교수"),
    ADMIN("관리자");

    private final String description;
}
