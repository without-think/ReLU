package com.smartsejong.api.domain.ecampus.service;

import com.smartsejong.api.domain.ecampus.client.EcampusClient;
import com.smartsejong.api.domain.ecampus.dto.EcampusCourseInfo;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class EcampusServiceImpl implements EcampusService {

    private final EcampusClient ecampusClient;

    @Override
    public List<EcampusCourseInfo> getCurrentSemester(String studentId, String password) {
        return ecampusClient.fetchCurrentSemester(studentId, password);
    }

    @Override
    public List<EcampusCourseInfo> getPastSemester(String studentId, String password, String year, String semester) {
        return ecampusClient.fetchPastSemester(studentId, password, year, semester);
    }
}
