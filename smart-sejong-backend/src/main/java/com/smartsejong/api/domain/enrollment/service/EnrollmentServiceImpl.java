package com.smartsejong.api.domain.enrollment.service;

import com.smartsejong.api.domain.course.entity.Course;
import com.smartsejong.api.domain.course.entity.Section;
import com.smartsejong.api.domain.course.repository.SectionRepository;
import com.smartsejong.api.domain.ecampus.client.EcampusClient;
import com.smartsejong.api.domain.ecampus.dto.EcampusCourseInfo;
import com.smartsejong.api.domain.enrollment.dto.CourseStudentsResponse;
import com.smartsejong.api.domain.enrollment.dto.EnrollmentResponse;
import com.smartsejong.api.domain.enrollment.dto.EnrollmentSyncResult;
import com.smartsejong.api.domain.enrollment.entity.Enrollment;
import com.smartsejong.api.domain.enrollment.repository.EnrollmentRepository;
import com.smartsejong.api.domain.user.entity.User;
import com.smartsejong.api.domain.user.repository.UserRepository;
import com.smartsejong.api.exception.CustomException;
import com.smartsejong.api.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class EnrollmentServiceImpl implements EnrollmentService {

    private final EnrollmentRepository enrollmentRepository;
    private final SectionRepository sectionRepository;
    private final UserRepository userRepository;
    private final EcampusClient ecampusClient;

    @Override
    @Transactional
    public EnrollmentSyncResult syncFromEcampus(Long userId, String studentId, String password, String semester) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

        // 현재 학기 기본값
        if (semester == null || semester.isBlank()) {
            semester = "2026-1";
        }

        // eCampus에서 수강 과목 가져오기
        List<EcampusCourseInfo> ecampusCourses;
        try {
            ecampusCourses = ecampusClient.fetchCurrentSemester(studentId, password);
        } catch (Exception e) {
            log.error("eCampus 과목 조회 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.ECAMPUS_FETCH_FAILED);
        }

        // 기존 수강 데이터 삭제 (해당 학기)
        enrollmentRepository.deleteByUserIdAndSemester(userId, semester);

        // 모든 Section 로드 (매칭용)
        List<Section> allSections = sectionRepository.findAllWithCourse();

        List<EnrollmentResponse> matchedEnrollments = new ArrayList<>();
        List<String> unmatchedCourses = new ArrayList<>();

        for (EcampusCourseInfo ecampusCourse : ecampusCourses) {
            Section matchedSection = findMatchingSection(ecampusCourse, allSections);

            if (matchedSection != null) {
                // 중복 확인 후 저장
                if (!enrollmentRepository.existsByUserIdAndSectionId(userId, matchedSection.getId())) {
                    Enrollment enrollment = Enrollment.builder()
                            .user(user)
                            .section(matchedSection)
                            .ecampusCourseId(ecampusCourse.getCourseId())
                            .semester(semester)
                            .build();
                    enrollmentRepository.save(enrollment);

                    matchedEnrollments.add(toEnrollmentResponse(enrollment, matchedSection));
                }
            } else {
                unmatchedCourses.add(ecampusCourse.getCourseName() + " (" + ecampusCourse.getProfessor() + ")");
                log.warn("매칭 실패: {} - {}", ecampusCourse.getCourseName(), ecampusCourse.getProfessor());
            }
        }

        return EnrollmentSyncResult.builder()
                .totalCourses(ecampusCourses.size())
                .matchedCount(matchedEnrollments.size())
                .unmatchedCount(unmatchedCourses.size())
                .unmatchedCourses(unmatchedCourses)
                .enrollments(matchedEnrollments)
                .build();
    }

    /**
     * eCampus 과목과 DB Section 매칭
     * 1. 과목명 유사도 비교
     * 2. 교수명 매칭
     */
    private Section findMatchingSection(EcampusCourseInfo ecampusCourse, List<Section> sections) {
        String ecampusName = normalize(ecampusCourse.getCourseName());
        String ecampusProf = normalize(ecampusCourse.getProfessor());

        Section bestMatch = null;
        int bestScore = 0;

        for (Section section : sections) {
            Course course = section.getCourse();
            String dbCourseName = normalize(course.getName());
            String dbProfessor = normalize(section.getProfessor());

            int score = 0;

            // 과목명 매칭 (필수)
            if (ecampusName.equals(dbCourseName)) {
                score += 100; // 정확히 일치
            } else if (ecampusName.contains(dbCourseName) || dbCourseName.contains(ecampusName)) {
                score += 70; // 부분 포함
            } else if (calculateSimilarity(ecampusName, dbCourseName) > 0.7) {
                score += 50; // 유사도 70% 이상
            } else {
                continue; // 과목명이 전혀 안 맞으면 스킵
            }

            // 교수명 매칭 (추가 점수)
            if (ecampusProf != null && dbProfessor != null) {
                if (ecampusProf.equals(dbProfessor)) {
                    score += 50; // 정확히 일치
                } else if (ecampusProf.contains(dbProfessor) || dbProfessor.contains(ecampusProf)) {
                    score += 30; // 부분 포함
                }
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = section;
            }
        }

        // 최소 점수 기준 (과목명이 어느 정도 맞아야 함)
        return bestScore >= 50 ? bestMatch : null;
    }

    /**
     * 문자열 정규화 (공백, 특수문자 제거, 소문자 변환)
     */
    private String normalize(String str) {
        if (str == null) return "";
        return str.replaceAll("[\\s\\-_()\\[\\]]", "").toLowerCase();
    }

    /**
     * 문자열 유사도 계산 (Jaccard similarity)
     */
    private double calculateSimilarity(String s1, String s2) {
        if (s1 == null || s2 == null || s1.isEmpty() || s2.isEmpty()) {
            return 0.0;
        }

        Set<Character> set1 = s1.chars().mapToObj(c -> (char) c).collect(Collectors.toSet());
        Set<Character> set2 = s2.chars().mapToObj(c -> (char) c).collect(Collectors.toSet());

        Set<Character> intersection = new HashSet<>(set1);
        intersection.retainAll(set2);

        Set<Character> union = new HashSet<>(set1);
        union.addAll(set2);

        return (double) intersection.size() / union.size();
    }

    @Override
    @Transactional(readOnly = true)
    public List<EnrollmentResponse> getMyEnrollments(Long userId, String semester) {
        List<Enrollment> enrollments;
        if (semester != null && !semester.isBlank()) {
            enrollments = enrollmentRepository.findByUserIdAndSemester(userId, semester);
        } else {
            enrollments = enrollmentRepository.findByUserIdWithSectionAndCourse(userId);
        }

        return enrollments.stream()
                .map(e -> toEnrollmentResponse(e, e.getSection()))
                .collect(Collectors.toList());
    }

    @Override
    @Transactional(readOnly = true)
    public CourseStudentsResponse getStudentsBySection(Long sectionId) {
        List<Enrollment> enrollments = enrollmentRepository.findBySectionIdWithUser(sectionId);
        if (enrollments.isEmpty()) {
            return null;
        }

        Section section = enrollments.get(0).getSection();
        Course course = section.getCourse();

        return CourseStudentsResponse.builder()
                .courseId(course.getId())
                .courseCode(course.getCourseCode())
                .courseName(course.getName())
                .professor(section.getProfessor())
                .studentCount(enrollments.size())
                .students(enrollments.stream()
                        .map(e -> CourseStudentsResponse.StudentInfo.builder()
                                .userId(e.getUser().getId())
                                .studentId(e.getUser().getStudentId())
                                .fullName(e.getUser().getFullName())
                                .major(e.getUser().getMajor())
                                .sectionNumber(section.getSectionNumber())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public CourseStudentsResponse getStudentsByCourse(Long courseId) {
        List<Enrollment> enrollments = enrollmentRepository.findByCourseIdWithUser(courseId);
        if (enrollments.isEmpty()) {
            return null;
        }

        Course course = enrollments.get(0).getSection().getCourse();

        return CourseStudentsResponse.builder()
                .courseId(course.getId())
                .courseCode(course.getCourseCode())
                .courseName(course.getName())
                .professor(null) // 여러 분반이므로 교수명은 null
                .studentCount(enrollments.size())
                .students(enrollments.stream()
                        .map(e -> CourseStudentsResponse.StudentInfo.builder()
                                .userId(e.getUser().getId())
                                .studentId(e.getUser().getStudentId())
                                .fullName(e.getUser().getFullName())
                                .major(e.getUser().getMajor())
                                .sectionNumber(e.getSection().getSectionNumber())
                                .build())
                        .collect(Collectors.toList()))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CourseStudentsResponse> getStudentsByProfessor(String professorName) {
        List<Enrollment> enrollments = enrollmentRepository.findByProfessorContainingWithUser(professorName);

        // 과목별로 그룹핑
        Map<Long, List<Enrollment>> byCourse = enrollments.stream()
                .collect(Collectors.groupingBy(e -> e.getSection().getCourse().getId()));

        return byCourse.entrySet().stream()
                .map(entry -> {
                    List<Enrollment> courseEnrollments = entry.getValue();
                    Course course = courseEnrollments.get(0).getSection().getCourse();
                    String professor = courseEnrollments.get(0).getSection().getProfessor();

                    return CourseStudentsResponse.builder()
                            .courseId(course.getId())
                            .courseCode(course.getCourseCode())
                            .courseName(course.getName())
                            .professor(professor)
                            .studentCount(courseEnrollments.size())
                            .students(courseEnrollments.stream()
                                    .map(e -> CourseStudentsResponse.StudentInfo.builder()
                                            .userId(e.getUser().getId())
                                            .studentId(e.getUser().getStudentId())
                                            .fullName(e.getUser().getFullName())
                                            .major(e.getUser().getMajor())
                                            .sectionNumber(e.getSection().getSectionNumber())
                                            .build())
                                    .collect(Collectors.toList()))
                            .build();
                })
                .collect(Collectors.toList());
    }

    private EnrollmentResponse toEnrollmentResponse(Enrollment enrollment, Section section) {
        Course course = section.getCourse();
        return EnrollmentResponse.builder()
                .enrollmentId(enrollment.getId())
                .sectionId(section.getId())
                .courseId(course.getId())
                .courseCode(course.getCourseCode())
                .courseName(course.getName())
                .professor(section.getProfessor())
                .credits(course.getCredits())
                .category(course.getCategory().getDescription())
                .dayOfWeek(section.getDayOfWeek())
                .dayOfWeekKor(section.getDayOfWeek() != null ? section.getDayOfWeek().getKor() : null)
                .startTime(section.getStartTime())
                .endTime(section.getEndTime())
                .room(section.getRoom())
                .ecampusCourseId(enrollment.getEcampusCourseId())
                .semester(enrollment.getSemester())
                .build();
    }
}
