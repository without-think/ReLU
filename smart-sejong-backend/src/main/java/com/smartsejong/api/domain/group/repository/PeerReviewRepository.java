package com.smartsejong.api.domain.group.repository;

import com.smartsejong.api.domain.group.entity.PeerReview;
import com.smartsejong.api.domain.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PeerReviewRepository extends JpaRepository<PeerReview, Long> {
    List<PeerReview> findByGroupIdAndReviewee(Long groupId, User reviewee);
    Optional<PeerReview> findByGroupIdAndReviewerAndReviewee(Long groupId, User reviewer, User reviewee);
    boolean existsByGroupIdAndReviewerAndReviewee(Long groupId, User reviewer, User reviewee);

    @Query("SELECT pr FROM PeerReview pr JOIN FETCH pr.reviewer JOIN FETCH pr.reviewee WHERE pr.group.id = :groupId")
    List<PeerReview> findByGroupIdWithUsers(@Param("groupId") Long groupId);
}
