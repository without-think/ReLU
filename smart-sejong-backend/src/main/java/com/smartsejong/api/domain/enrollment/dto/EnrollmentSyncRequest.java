package com.smartsejong.api.domain.enrollment.dto;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class EnrollmentSyncRequest {
    private String password; // eCampus 비밀번호 (포털 비밀번호)
    private String semester; // 학기 (예: "2026-1"), null이면 현재학기
}
