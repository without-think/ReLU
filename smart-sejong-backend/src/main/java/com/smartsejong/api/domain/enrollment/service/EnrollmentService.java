package com.smartsejong.api.domain.enrollment.service;

import com.smartsejong.api.domain.enrollment.dto.CourseStudentsResponse;
import com.smartsejong.api.domain.enrollment.dto.EnrollmentResponse;
import com.smartsejong.api.domain.enrollment.dto.EnrollmentSyncResult;

import java.util.List;

public interface EnrollmentService {

    /**
     * eCampus에서 수강 과목을 가져와서 DB의 Section과 매칭 후 저장
     */
    EnrollmentSyncResult syncFromEcampus(Long userId, String studentId, String password, String semester);

    /**
     * 학생의 수강 과목 목록 조회
     */
    List<EnrollmentResponse> getMyEnrollments(Long userId, String semester);

    /**
     * 특정 과목(Section)의 수강생 목록 조회 (교수용)
     */
    CourseStudentsResponse getStudentsBySection(Long sectionId);

    /**
     * 특정 과목(Course)의 모든 분반 수강생 목록 조회 (교수용)
     */
    CourseStudentsResponse getStudentsByCourse(Long courseId);

    /**
     * 교수명으로 담당 과목들의 수강생 목록 조회
     */
    List<CourseStudentsResponse> getStudentsByProfessor(String professorName);
}
