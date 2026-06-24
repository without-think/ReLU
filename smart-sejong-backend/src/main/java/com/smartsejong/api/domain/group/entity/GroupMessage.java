package com.smartsejong.api.domain.group.entity;

import com.smartsejong.api.common.entity.BaseTimeEntity;
import com.smartsejong.api.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "group_messages", indexes = {
    @Index(name = "idx_group_messages_group_created", columnList = "group_id, created_at DESC")
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class GroupMessage extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private User sender;

    @Column(nullable = false, length = 2000)
    private String content;

    // 답장 대상 메시지
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reply_to_id")
    private GroupMessage replyTo;

    // 언급된 사용자 ID들 (쉼표로 구분)
    @Column(length = 500)
    private String mentionedUserIds;

    @Column
    private LocalDateTime editedAt;

    @Column
    private boolean deleted = false;

    @Builder
    public GroupMessage(Group group, User sender, String content, GroupMessage replyTo, String mentionedUserIds) {
        this.group = group;
        this.sender = sender;
        this.content = content;
        this.replyTo = replyTo;
        this.mentionedUserIds = mentionedUserIds;
    }

    public void updateContent(String content) {
        this.content = content;
        this.editedAt = LocalDateTime.now();
    }

    public void markDeleted() {
        this.deleted = true;
        this.content = "(삭제된 메시지입니다)";
    }
}
