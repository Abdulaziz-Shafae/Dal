package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.MessageService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/message")
public class MessageController {

    private final MessageService messageService;

    @PostMapping("/group/{groupId}/to/{receiverId}")
    public ResponseEntity<?> sendMessage(@PathVariable Integer groupId, @PathVariable Integer receiverId, @RequestBody @Valid SendMessageDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(messageService.sendMessage((Integer) session.getAttribute("userId"), groupId, receiverId, input));
    }

    @GetMapping("/group/{groupId}/with/{otherUserId}")
    public ResponseEntity<?> getConversation(@PathVariable Integer groupId, @PathVariable Integer otherUserId, @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, HttpSession session) {
        return ResponseEntity.status(200).body(messageService.getConversation((Integer) session.getAttribute("userId"), groupId, otherUserId, page, size));
    }

    @PutMapping("/{messageId}/read")
    public ResponseEntity<?> markMessageRead(@PathVariable Integer messageId, HttpSession session) {
        return ResponseEntity.status(200).body(messageService.markMessageRead((Integer) session.getAttribute("userId"), messageId));
    }
}
