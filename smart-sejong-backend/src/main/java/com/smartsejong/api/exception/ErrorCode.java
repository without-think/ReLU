package com.smartsejong.api.exception;

import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;

/**
 * 비즈니스 에러 코드 정의
 */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {
    // Auth (A0xx)
    PORTAL_VERIFICATION_FAILED(HttpStatus.BAD_REQUEST, "A002", "포털 인증에 실패했습니다. 아이디나 비밀번호를 확인하세요."),
    SEJONG_AUTH_FAILED(HttpStatus.UNAUTHORIZED, "A007", "세종대 포털 인증에 실패했습니다. 학번과 비밀번호를 확인하세요."),
    INVALID_JWT_TOKEN(HttpStatus.UNAUTHORIZED, "A003", "유효하지 않은 JWT 토큰입니다."),
    EXPIRED_JWT_TOKEN(HttpStatus.UNAUTHORIZED, "A004", "만료된 JWT 토큰입니다."),
    INVALID_REFRESH_TOKEN(HttpStatus.UNAUTHORIZED, "A005", "유효하지 않은 리프레시 토큰입니다."),
    USER_NOT_FOUND(HttpStatus.NOT_FOUND, "A006", "사용자를 찾을 수 없습니다."),

    // Academic / Course
    INVALID_CSV_FORMAT(HttpStatus.BAD_REQUEST, "L001", "잘못된 CSV 파일 형식입니다."),
    INVALID_EXCEL_FORMAT(HttpStatus.BAD_REQUEST, "L002", "잘못된 Excel 파일 형식입니다."),
    COURSE_NOT_FOUND(HttpStatus.NOT_FOUND, "L003", "해당 과목을 찾을 수 없습니다."),
    SECTION_NOT_FOUND(HttpStatus.NOT_FOUND, "L004", "해당 분반을 찾을 수 없습니다."),

    // Group
    GROUP_NOT_FOUND(HttpStatus.NOT_FOUND, "G001", "해당 그룹을 찾을 수 없습니다."),
    GROUP_ALREADY_FULL(HttpStatus.BAD_REQUEST, "G002", "그룹 인원이 가득 찼습니다."),
    ALREADY_GROUP_MEMBER(HttpStatus.BAD_REQUEST, "G003", "이미 그룹에 참가되어 있습니다."),
    TASK_NOT_FOUND(HttpStatus.NOT_FOUND, "G004", "해당 과제를 찾을 수 없습니다."),
    PEER_REVIEW_ALREADY_SUBMITTED(HttpStatus.BAD_REQUEST, "G005", "이미 해당 팀원에 대한 동료평가를 제출했습니다."),
    FILE_UPLOAD_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "G006", "파일 업로드에 실패했습니다."),
    FILE_NOT_FOUND(HttpStatus.NOT_FOUND, "G007", "파일을 찾을 수 없습니다."),

    // Ecampus
    ECAMPUS_AUTH_FAILED(HttpStatus.UNAUTHORIZED, "E001", "e캠퍼스 로그인에 실패했습니다."),
    ECAMPUS_SCRAPE_FAILED(HttpStatus.INTERNAL_SERVER_ERROR, "E002", "e캠퍼스 데이터 조회에 실패했습니다."),

    // Common
    INTERNAL_SERVER_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "C001", "서버 내부 오류가 발생했습니다."),
    INVALID_INPUT_VALUE(HttpStatus.BAD_REQUEST, "C002", "잘못된 입력값입니다.");

    private final HttpStatus status;
    private final String code;
    private final String message;
}
