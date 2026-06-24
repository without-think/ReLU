package com.smartsejong.api.domain.group.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;
import java.util.Map;

@Getter
@AllArgsConstructor
public class AvailabilityResponse {
    // userId -> list of slots they marked available
    private Map<Long, List<SlotDto>> memberSlots;
    // slot -> count of members available (heatmap)
    private Map<String, Integer> heatmap;

    @Getter
    @AllArgsConstructor
    public static class SlotDto {
        private String dayOfWeek;
        private int slot;
    }
}
