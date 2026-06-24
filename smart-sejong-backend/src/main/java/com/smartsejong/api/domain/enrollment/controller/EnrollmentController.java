package com.smartsejong.api.domain.enrollment.controller;

import com.smartsejong.api.common.CommonResponse;
import com.smartsejong.api.security.CustomUserDetails;
import com.smartsejong.api.domain.enrollment.dto.CourseStudentsResponse;
import com.smartsejong.api.domain.enrollment.dto.EnrollmentResponse;
import com.smartsejong.api.domain.enrollment.dto.EnrollmentSyncRequest;
import com.smartsejong.api.domain.enrollment.dto.EnrollmentSyncResult;
import com.smartsejong.api.domain.enrollment.service.EnrollmentService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Enrollment", description = "수강 등록 API")
@RestController
@RequestMapping("/api/enrollments")
@RequiredArgsConstructor
public class EnrollmentController {

    private final EnrollmentService enrollmentService;

    @Operation(summary = "eCampus 수강 과목 동기화", description = "eCampus에서 수강 과목을 가져와 DB와 매칭합니다")
    @PostMapping("/sync")
    public ResponseEntity<CommonResponse<EnrollmentSyncResult>> syncFromEcampus(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestBody EnrollmentSyncRequest request) {

        EnrollmentSyncResult result = enrollmentService.syncFromEcampus(
                userDetails.getUserId(),
                userDetails.getUsername(), // studentId
                request.getPassword(),
                request.getSemester()
        );

        return ResponseEntity.ok(CommonResponse.success("수강 과목 동기화 완료", result));
    }

    @Operation(summary = "내 수강 과목 조회", description = "현재 로그인한 학생의 수강 과목 목록을 조회합니다")
    @GetMapping("/my")
    public ResponseEntity<CommonResponse<List<EnrollmentResponse>>> getMyEnrollments(
            @AuthenticationPrincipal CustomUserDetails userDetails,
            @RequestParam(required = false) String semester) {

        List<EnrollmentResponse> enrollments = enrollmentService.getMyEnrollments(
                userDetails.getUserId(), semester);

        return ResponseEntity.ok(CommonResponse.success(enrollments));
    }

    @Operation(summary = "분반별 수강생 조회", description = "특정 분반(Section)의 수강생 목록을 조회합니다 (교수용)")
    @GetMapping("/sections/{sectionId}/students")
    public ResponseEntity<CommonResponse<CourseStudentsResponse>> getStudentsBySection(
            @PathVariable Long sectionId) {

        CourseStudentsResponse response = enrollmentService.getStudentsBySection(sectionId);
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @Operation(summary = "과목별 수강생 조회", description = "특정 과목(Course)의 모든 분반 수강생을 조회합니다 (교수용)")
    @GetMapping("/courses/{courseId}/students")
    public ResponseEntity<CommonResponse<CourseStudentsResponse>> getStudentsByCourse(
            @PathVariable Long courseId) {

        CourseStudentsResponse response = enrollmentService.getStudentsByCourse(courseId);
        return ResponseEntity.ok(CommonResponse.success(response));
    }

    @Operation(summary = "교수별 수강생 조회", description = "교수명으로 담당 과목들의 수강생을 조회합니다")
    @GetMapping("/professors/{professorName}/students")
    public ResponseEntity<CommonResponse<List<CourseStudentsResponse>>> getStudentsByProfessor(
            @PathVariable String professorName) {

        List<CourseStudentsResponse> response = enrollmentService.getStudentsByProfessor(professorName);
        return ResponseEntity.ok(CommonResponse.success(response));
    }
}
