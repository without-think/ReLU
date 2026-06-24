package com.smartsejong.api.domain.group.entity;

import com.smartsejong.api.common.entity.BaseTimeEntity;
import com.smartsejong.api.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "message_read_receipts", indexes = {
    @Index(name = "idx_read_receipts_group_user", columnList = "group_id, user_id")
}, uniqueConstraints = {
    @UniqueConstraint(columnNames = {"group_id", "user_id"})
})
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class MessageReadReceipt extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // 마지막으로 읽은 메시지 ID
    @Column(name = "last_read_message_id")
    private Long lastReadMessageId;

    @Builder
    public MessageReadReceipt(Group group, User user, Long lastReadMessageId) {
        this.group = group;
        this.user = user;
        this.lastReadMessageId = lastReadMessageId;
    }

    public void updateLastReadMessageId(Long messageId) {
        if (this.lastReadMessageId == null || messageId > this.lastReadMessageId) {
            this.lastReadMessageId = messageId;
        }
    }
}
