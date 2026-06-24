package com.smartsejong.api.domain.group.repository;

import com.smartsejong.api.domain.group.entity.Group;
import com.smartsejong.api.domain.group.entity.GroupMember;
import com.smartsejong.api.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface GroupMemberRepository extends JpaRepository<GroupMember, Long> {
    List<GroupMember> findByUser(User user);
    List<GroupMember> findByGroup(Group group);
    Optional<GroupMember> findByGroupAndUser(Group group, User user);
    boolean existsByGroupAndUser(Group group, User user);

    @Query("SELECT gm FROM GroupMember gm JOIN FETCH gm.user WHERE gm.group.id = :groupId")
    List<GroupMember> findByGroupIdWithUser(@Param("groupId") Long groupId);
}
