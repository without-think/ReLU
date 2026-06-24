package com.smartsejong.api.domain.group.entity;

import com.smartsejong.api.common.entity.BaseTimeEntity;
import com.smartsejong.api.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "peer_reviews",
        uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "reviewer_id", "reviewee_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class PeerReview extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id", nullable = false)
    private User reviewer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewee_id", nullable = false)
    private User reviewee;

    // 기여도 점수 (0-100, 팀원들 합산 100)
    @Column(nullable = false)
    private int contributionScore;

    // Loughry et al. 5 dimensions (1-5 each)
    @Column(nullable = false)
    private int contributing;   // 기여도

    @Column(nullable = false)
    private int interacting;    // 소통

    @Column(nullable = false)
    private int keepingOnTrack; // 일정관리

    @Column(nullable = false)
    private int expectingQuality; // 품질추구

    @Column(nullable = false)
    private int knowledgeSkills; // 역량

    @Column(length = 500)
    private String comment;

    // 무임승차 의심 여부 (기준 미달 시 true)
    @Column(nullable = false)
    private boolean suspectedFreeRider = false;

    @Builder
    public PeerReview(Group group, User reviewer, User reviewee,
                      int contributionScore, int contributing, int interacting,
                      int keepingOnTrack, int expectingQuality, int knowledgeSkills,
                      String comment, boolean suspectedFreeRider) {
        this.group = group;
        this.reviewer = reviewer;
        this.reviewee = reviewee;
        this.contributionScore = contributionScore;
        this.contributing = contributing;
        this.interacting = interacting;
        this.keepingOnTrack = keepingOnTrack;
        this.expectingQuality = expectingQuality;
        this.knowledgeSkills = knowledgeSkills;
        this.comment = comment;
        this.suspectedFreeRider = suspectedFreeRider;
    }
}
