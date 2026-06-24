package com.smartsejong.api.domain.enrollment.repository;

import com.smartsejong.api.domain.enrollment.entity.Enrollment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface EnrollmentRepository extends JpaRepository<Enrollment, Long> {

    // 학생의 모든 수강 과목 조회
    @Query("SELECT e FROM Enrollment e JOIN FETCH e.section s JOIN FETCH s.course WHERE e.user.id = :userId")
    List<Enrollment> findByUserIdWithSectionAndCourse(@Param("userId") Long userId);

    // 학생의 특정 학기 수강 과목 조회
    @Query("SELECT e FROM Enrollment e JOIN FETCH e.section s JOIN FETCH s.course WHERE e.user.id = :userId AND e.semester = :semester")
    List<Enrollment> findByUserIdAndSemester(@Param("userId") Long userId, @Param("semester") String semester);

    // 특정 Section을 수강하는 모든 학생 조회
    @Query("SELECT e FROM Enrollment e JOIN FETCH e.user WHERE e.section.id = :sectionId")
    List<Enrollment> findBySectionIdWithUser(@Param("sectionId") Long sectionId);

    // 특정 과목(Course)을 수강하는 모든 학생 조회 (교수용)
    @Query("SELECT e FROM Enrollment e JOIN FETCH e.user JOIN FETCH e.section s WHERE s.course.id = :courseId")
    List<Enrollment> findByCourseIdWithUser(@Param("courseId") Long courseId);

    // 특정 교수의 모든 수강생 조회
    @Query("SELECT e FROM Enrollment e JOIN FETCH e.user JOIN FETCH e.section s JOIN FETCH s.course WHERE s.professor = :professor")
    List<Enrollment> findByProfessorWithUser(@Param("professor") String professor);

    // 교수명으로 수강생 조회 (부분 매칭)
    @Query("SELECT e FROM Enrollment e JOIN FETCH e.user JOIN FETCH e.section s JOIN FETCH s.course WHERE s.professor LIKE %:professor%")
    List<Enrollment> findByProfessorContainingWithUser(@Param("professor") String professor);

    // 중복 확인
    boolean existsByUserIdAndSectionId(Long userId, Long sectionId);

    Optional<Enrollment> findByUserIdAndEcampusCourseId(Long userId, String ecampusCourseId);

    // 학생의 특정 학기 수강 데이터 삭제
    @Modifying
    @Query("DELETE FROM Enrollment e WHERE e.user.id = :userId AND e.semester = :semester")
    void deleteByUserIdAndSemester(@Param("userId") Long userId, @Param("semester") String semester);
}
