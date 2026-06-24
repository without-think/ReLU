package com.smartsejong.api.domain.enrollment.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class EnrollmentSyncResult {
    private int totalCourses;      // eCampus에서 가져온 총 과목 수
    private int matchedCount;      // DB와 매칭 성공한 과목 수
    private int unmatchedCount;    // 매칭 실패한 과목 수
    private List<String> unmatchedCourses; // 매칭 실패한 과목명 목록
    private List<EnrollmentResponse> enrollments; // 매칭된 수강 정보
}
