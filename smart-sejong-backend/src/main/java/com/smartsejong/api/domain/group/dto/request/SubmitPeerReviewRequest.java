package com.smartsejong.api.domain.group.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@NoArgsConstructor
public class SubmitPeerReviewRequest {
    private Long revieweeId;
    private int contributionScore;
    private int contributing;
    private int interacting;
    private int keepingOnTrack;
    private int expectingQuality;
    private int knowledgeSkills;
    private String comment;
}
