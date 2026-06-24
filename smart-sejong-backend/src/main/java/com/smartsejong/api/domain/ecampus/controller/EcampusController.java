package com.smartsejong.api.domain.ecampus.controller;

import com.smartsejong.api.auth.dto.SejongVerifyRequest;
import com.smartsejong.api.common.CommonResponse;
import com.smartsejong.api.domain.ecampus.dto.EcampusCourseInfo;
import com.smartsejong.api.domain.ecampus.service.EcampusService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Tag(name = "Ecampus", description = "e캠퍼스 강의 및 과제 조회 API")
@RestController
@RequestMapping("/api/ecampus")
@RequiredArgsConstructor
public class EcampusController {

    private final EcampusService ecampusService;

    @Operation(
            summary = "현재학기 강의 및 과제 조회",
            description = "e캠퍼스 현재학기 강의목록과 각 강의의 과제 마감일·제출 시간을 반환합니다."
    )
    @PostMapping("/courses/current")
    public ResponseEntity<CommonResponse<List<EcampusCourseInfo>>> getCurrentSemester(
            @Valid @RequestBody SejongVerifyRequest request
    ) {
        List<EcampusCourseInfo> courses = ecampusService.getCurrentSemester(
                request.getStudentId(), request.getPassword()
        );
        return ResponseEntity.ok(CommonResponse.success("현재학기 강의 조회 성공", courses));
    }

    @Operation(
            summary = "이전학기 강의 및 과제 조회",
            description = "e캠퍼스 특정 연도·학기의 강의목록과 과제 정보를 반환합니다. " +
                    "semester 코드: 10=1학기, 20=2학기, 11=여름계절, 21=겨울계절, all=전체"
    )
    @PostMapping("/courses/past")
    public ResponseEntity<CommonResponse<List<EcampusCourseInfo>>> getPastSemester(
            @Valid @RequestBody SejongVerifyRequest request,
            @Parameter(description = "연도 (예: 2025)", example = "2025")
            @RequestParam String year,
            @Parameter(description = "학기 코드 (10=1학기, 20=2학기, 11=여름계절, 21=겨울계절, all=전체)", example = "20")
            @RequestParam String semester
    ) {
        List<EcampusCourseInfo> courses = ecampusService.getPastSemester(
                request.getStudentId(), request.getPassword(), year, semester
        );
        return ResponseEntity.ok(CommonResponse.success(year + "년 " + semester + "학기 강의 조회 성공", courses));
    }
}
