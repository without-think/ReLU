package com.smartsejong.api.domain.group.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@AllArgsConstructor
public class PeerReviewSummaryResponse {
    private List<MemberScoreDto> memberScores;
    private List<ReviewCommentDto> reviewComments;
    private List<SubmittedReviewDto> submittedReviews;

    @Getter
    @AllArgsConstructor
    public static class MemberScoreDto {
        private Long userId;
        private String name;
        private double avgContributionScore;
        private double avgContributing;
        private double avgInteracting;
        private double avgKeepingOnTrack;
        private double avgExpectingQuality;
        private double avgKnowledgeSkills;
        private double overallTemperatureDelta;
        private boolean suspectedFreeRider;
        private int reviewCount;
    }

    @Getter
    @AllArgsConstructor
    public static class ReviewCommentDto {
        private Long reviewerId;
        private String reviewerName;
        private Long revieweeId;
        private String revieweeName;
        private int contributionScore;
        private int contributing;
        private int interacting;
        private int keepingOnTrack;
        private int expectingQuality;
        private int knowledgeSkills;
        private String comment;
        private LocalDateTime createdAt;
    }

    @Getter
    @AllArgsConstructor
    public static class SubmittedReviewDto {
        private Long reviewerId;
        private Long revieweeId;
    }
}
