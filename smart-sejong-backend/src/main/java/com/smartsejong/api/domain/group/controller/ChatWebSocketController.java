package com.smartsejong.api.domain.group.controller;

import com.smartsejong.api.domain.group.dto.request.SendMessageRequest;
import com.smartsejong.api.domain.group.dto.response.MessageResponse;
import com.smartsejong.api.domain.group.service.GroupService;
import lombok.RequiredArgsConstructor;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

@Controller
@RequiredArgsConstructor
public class ChatWebSocketController {

    private final GroupService groupService;

    @MessageMapping("/chat/{groupId}")
    @SendTo("/topic/group/{groupId}")
    public MessageResponse handleChatMessage(
            @DestinationVariable Long groupId,
            SendMessageRequest request,
            SimpMessageHeaderAccessor headerAccessor) {

        // 실제 운영에서는 headerAccessor에서 사용자 정보를 가져와야 함
        // 현재는 REST API를 통해 메시지 저장 후 WebSocket으로 브로드캐스트
        // 프론트에서 REST로 저장 후 WebSocket으로 브로드캐스트하는 방식 사용

        return null; // REST API에서 처리
    }
}
