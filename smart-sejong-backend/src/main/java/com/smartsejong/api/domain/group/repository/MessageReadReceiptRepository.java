package com.smartsejong.api.domain.group.repository;

import com.smartsejong.api.domain.group.entity.MessageReadReceipt;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface MessageReadReceiptRepository extends JpaRepository<MessageReadReceipt, Long> {

    Optional<MessageReadReceipt> findByGroupIdAndUserId(Long groupId, Long userId);

    List<MessageReadReceipt> findByGroupId(Long groupId);

    @Query("SELECT r.user.id, r.lastReadMessageId FROM MessageReadReceipt r WHERE r.group.id = :groupId")
    List<Object[]> findReadStatusByGroupId(@Param("groupId") Long groupId);
}
