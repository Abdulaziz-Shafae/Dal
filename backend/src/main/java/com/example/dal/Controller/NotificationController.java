package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.NotificationService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/notification")
public class NotificationController {

    private final NotificationService notificationService;

    @GetMapping("/unread-count")
    public ResponseEntity<?> unreadCount(HttpSession session) {
        return ResponseEntity.ok(java.util.Map.of("count", notificationService.unreadCount((Integer) session.getAttribute("userId"))));
    }

    @PostMapping("/group/{groupId}/nudge/{receiverId}")
    public ResponseEntity<?> nudgeGroupMember(@PathVariable Integer groupId, @PathVariable Integer receiverId, @RequestBody @Valid NudgeDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(notificationService.nudgeGroupMember((Integer) session.getAttribute("userId"), groupId, receiverId, input));
    }

    @GetMapping("/my")
    public ResponseEntity<?> getMyNotifications(@RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "20") int size, HttpSession session) {
        return ResponseEntity.status(200).body(notificationService.getMyNotifications((Integer) session.getAttribute("userId"), page, size));
    }

    @PutMapping("/{notificationId}/read")
    public ResponseEntity<?> markNotificationRead(@PathVariable Integer notificationId, HttpSession session) {
        return ResponseEntity.status(200).body(notificationService.markNotificationRead((Integer) session.getAttribute("userId"), notificationId));
    }
}
