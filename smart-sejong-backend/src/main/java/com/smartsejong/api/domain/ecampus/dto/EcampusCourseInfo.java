package com.smartsejong.api.domain.ecampus.dto;

import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class EcampusCourseInfo {
    private final String courseId;
    private final String courseName;
    private final String professor;
    private final List<EcampusAssignmentInfo> assignments;
}
