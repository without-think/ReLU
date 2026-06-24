package com.smartsejong.api.domain.group.dto.response;

import com.smartsejong.api.domain.group.entity.PeerReview;
import lombok.Getter;

@Getter
public class PeerReviewDetailResponse {
    private final Long reviewerId;
    private final String reviewerName;
    private final Long revieweeId;
    private final String revieweeName;
    private final int contributionScore;
    private final int contributing;
    private final int interacting;
    private final int keepingOnTrack;
    private final int expectingQuality;
    private final int knowledgeSkills;
    private final String comment;
    private final boolean suspectedFreeRider;

    public PeerReviewDetailResponse(PeerReview pr) {
        this.reviewerId = pr.getReviewer().getId();
        this.reviewerName = pr.getReviewer().getFullName();
        this.revieweeId = pr.getReviewee().getId();
        this.revieweeName = pr.getReviewee().getFullName();
        this.contributionScore = pr.getContributionScore();
        this.contributing = pr.getContributing();
        this.interacting = pr.getInteracting();
        this.keepingOnTrack = pr.getKeepingOnTrack();
        this.expectingQuality = pr.getExpectingQuality();
        this.knowledgeSkills = pr.getKnowledgeSkills();
        this.comment = pr.getComment();
        this.suspectedFreeRider = pr.isSuspectedFreeRider();
    }
}
