package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.GroupJoinRequestService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/join-request")
public class GroupJoinRequestController {

    private final GroupJoinRequestService groupJoinRequestService;

    @GetMapping("/my")
    public ResponseEntity<?> getMyJoinRequests(HttpSession session) {
        return ResponseEntity.status(200).body(groupJoinRequestService.getMyJoinRequests((Integer) session.getAttribute("userId")));
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<?> getGroupJoinRequests(@PathVariable Integer groupId, @RequestParam(required = false) String status, HttpSession session) {
        return ResponseEntity.status(200).body(groupJoinRequestService.getGroupJoinRequests((Integer) session.getAttribute("userId"), groupId, status));
    }

    @PutMapping("/{requestId}/approve")
    public ResponseEntity<?> approveJoinRequest(@PathVariable Integer requestId, HttpSession session) {
        return ResponseEntity.status(200).body(groupJoinRequestService.approveJoinRequest((Integer) session.getAttribute("userId"), requestId));
    }

    @PutMapping("/{requestId}/reject")
    public ResponseEntity<?> rejectJoinRequest(@PathVariable Integer requestId, HttpSession session) {
        return ResponseEntity.status(200).body(groupJoinRequestService.rejectJoinRequest((Integer) session.getAttribute("userId"), requestId));
    }

    @DeleteMapping("/{requestId}")
    public ResponseEntity<?> cancelJoinRequest(@PathVariable Integer requestId, HttpSession session) {
        groupJoinRequestService.cancelJoinRequest((Integer) session.getAttribute("userId"), requestId);
        return ResponseEntity.status(200).body(new ApiResponse("Join request cancelled successfully"));
    }
}
