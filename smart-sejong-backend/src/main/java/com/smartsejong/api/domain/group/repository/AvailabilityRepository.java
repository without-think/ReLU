package com.smartsejong.api.domain.group.repository;

import com.smartsejong.api.domain.group.entity.Availability;
import com.smartsejong.api.domain.group.entity.Group;
import com.smartsejong.api.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface AvailabilityRepository extends JpaRepository<Availability, Long> {
    List<Availability> findByGroupAndUser(Group group, User user);
    void deleteByGroupAndUser(Group group, User user);

    @Query("SELECT a FROM Availability a JOIN FETCH a.user WHERE a.group.id = :groupId")
    List<Availability> findByGroupIdWithUser(@Param("groupId") Long groupId);
}
