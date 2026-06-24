package com.smartsejong.api.domain.group.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

@Getter
@AllArgsConstructor
public class PeerReviewSummaryResponse {
    private List<MemberScoreDto> memberScores;

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
}
