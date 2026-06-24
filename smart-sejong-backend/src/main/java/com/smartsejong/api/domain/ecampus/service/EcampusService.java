package com.smartsejong.api.domain.ecampus.service;

import com.smartsejong.api.domain.ecampus.dto.EcampusCourseInfo;

import java.util.List;

public interface EcampusService {
    List<EcampusCourseInfo> getCurrentSemester(String studentId, String password);
    List<EcampusCourseInfo> getPastSemester(String studentId, String password, String year, String semester);
}
