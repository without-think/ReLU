package com.smartsejong.api.domain.group.dto.response;

import com.smartsejong.api.domain.group.entity.GroupMessage;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.stream.Collectors;

@Getter
public class MessageResponse {
    private final Long id;
    private final Long groupId;
    private final Long senderId;
    private final String senderName;
    private final String content;
    private final LocalDateTime createdAt;
    private final LocalDateTime editedAt;
    private final boolean deleted;

    // 답장 관련 필드
    private final Long replyToId;
    private final String replyToContent;
    private final String replyToSenderName;

    // 언급된 사용자 ID 목록
    private final List<Long> mentionedUserIds;

    public MessageResponse(GroupMessage message) {
        this.id = message.getId();
        this.groupId = message.getGroup().getId();
        this.senderId = message.getSender().getId();
        this.senderName = message.getSender().getFullName();
        this.content = message.getContent();
        this.createdAt = message.getCreatedAt();
        this.editedAt = message.getEditedAt();
        this.deleted = message.isDeleted();

        // 답장 정보
        if (message.getReplyTo() != null) {
            this.replyToId = message.getReplyTo().getId();
            this.replyToContent = message.getReplyTo().isDeleted()
                ? "(삭제된 메시지)"
                : truncateContent(message.getReplyTo().getContent(), 50);
            this.replyToSenderName = message.getReplyTo().getSender().getFullName();
        } else {
            this.replyToId = null;
            this.replyToContent = null;
            this.replyToSenderName = null;
        }

        // 언급된 사용자 ID 파싱
        if (message.getMentionedUserIds() != null && !message.getMentionedUserIds().isEmpty()) {
            this.mentionedUserIds = Arrays.stream(message.getMentionedUserIds().split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .map(Long::parseLong)
                .collect(Collectors.toList());
        } else {
            this.mentionedUserIds = Collections.emptyList();
        }
    }

    private String truncateContent(String content, int maxLength) {
        if (content == null) return null;
        if (content.length() <= maxLength) return content;
        return content.substring(0, maxLength) + "...";
    }
}
