package com.smartsejong.api.domain.enrollment.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class CourseStudentsResponse {
    private Long courseId;
    private String courseCode;
    private String courseName;
    private String professor;
    private int studentCount;
    private List<StudentInfo> students;

    @Getter
    @Builder
    public static class StudentInfo {
        private Long userId;
        private String studentId;
        private String fullName;
        private String major;
        private String sectionNumber;
    }
}
