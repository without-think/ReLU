package com.smartsejong.api.domain.group.dto.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.Map;

@Getter
@AllArgsConstructor
public class ReadReceiptResponse {
    // userId -> lastReadMessageId
    private Map<Long, Long> readStatus;
}
