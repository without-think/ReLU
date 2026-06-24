package com.smartsejong.api.domain.group.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class SendMessageRequest {
    @NotBlank(message = "메시지 내용은 필수입니다")
    @Size(max = 2000, message = "메시지는 2000자를 초과할 수 없습니다")
    private String content;

    // 답장 대상 메시지 ID (optional)
    private Long replyToId;

    // 언급된 사용자 ID 목록 (optional)
    private List<Long> mentionedUserIds;
}
