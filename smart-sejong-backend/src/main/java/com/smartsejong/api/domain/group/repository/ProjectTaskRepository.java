package com.smartsejong.api.domain.group.repository;

import com.smartsejong.api.domain.group.entity.Group;
import com.smartsejong.api.domain.group.entity.ProjectTask;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ProjectTaskRepository extends JpaRepository<ProjectTask, Long> {
    @Query("SELECT t FROM ProjectTask t LEFT JOIN FETCH t.assignee WHERE t.group.id = :groupId ORDER BY t.deadline ASC NULLS LAST")
    List<ProjectTask> findByGroupIdOrderByDeadline(@Param("groupId") Long groupId);

    List<ProjectTask> findByGroup(Group group);
}
