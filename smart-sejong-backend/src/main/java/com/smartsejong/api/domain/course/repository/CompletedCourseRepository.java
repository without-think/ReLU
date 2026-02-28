package com.smartsejong.api.repository;

import com.smartsejong.api.entity.CompletedCourse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CompletedCourseRepository extends JpaRepository<CompletedCourse, Long> {

    List<CompletedCourse> findByUserId(Long userId);

    List<CompletedCourse> findByUserIdAndYearAndSemester(Long userId, String year, String semester);

    Optional<CompletedCourse> findByUserIdAndCourseCode(Long userId, String courseCode);

    boolean existsByUserIdAndCourseCode(Long userId, String courseCode);

    boolean existsByUserIdAndCourseCodeAndYearAndSemester(Long userId, String courseCode, String year, String semester);

    List<CompletedCourse> findByUserIdAndCategory(Long userId, String category);

    void deleteByUserId(Long userId);
}
