package com.smartsejong.api.domain.enrollment.dto;

import com.smartsejong.api.common.enums.DayOfWeek;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalTime;

@Getter
@Builder
public class EnrollmentResponse {
    private Long enrollmentId;
    private Long sectionId;
    private Long courseId;
    private String courseCode;
    private String courseName;
    private String professor;
    private int credits;
    private String category;
    private DayOfWeek dayOfWeek;
    private String dayOfWeekKor;
    private LocalTime startTime;
    private LocalTime endTime;
    private String room;
    private String ecampusCourseId;
    private String semester;
}
