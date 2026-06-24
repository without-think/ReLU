package com.smartsejong.api.domain.group.dto.request;

import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

@Getter
@NoArgsConstructor
public class SetAvailabilityRequest {
    // Each slot: { dayOfWeek: "MON", slot: 0 } -> 09:00, slot: 1 -> 09:30 ...
    private List<SlotDto> slots;

    @Getter
    @NoArgsConstructor
    public static class SlotDto {
        private String dayOfWeek;
        private int slot;
    }
}
