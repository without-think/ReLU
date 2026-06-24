package com.smartsejong.api.domain.group.repository;

import com.smartsejong.api.domain.group.entity.GroupMessage;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface GroupMessageRepository extends JpaRepository<GroupMessage, Long> {

    @Query("SELECT m FROM GroupMessage m JOIN FETCH m.sender WHERE m.group.id = :groupId ORDER BY m.createdAt DESC")
    Page<GroupMessage> findByGroupIdOrderByCreatedAtDesc(@Param("groupId") Long groupId, Pageable pageable);

    @Query("SELECT m FROM GroupMessage m JOIN FETCH m.sender WHERE m.group.id = :groupId AND m.createdAt > :since ORDER BY m.createdAt ASC")
    List<GroupMessage> findByGroupIdAndCreatedAtAfter(@Param("groupId") Long groupId, @Param("since") LocalDateTime since);

    @Query("SELECT COUNT(m) FROM GroupMessage m WHERE m.group.id = :groupId")
    long countByGroupId(@Param("groupId") Long groupId);
}
