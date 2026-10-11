package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.MeetingPointService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/meeting-point")
public class MeetingPointController {

    private final MeetingPointService meetingPointService;

    @PutMapping("/group/{groupId}")
    public ResponseEntity<?> setMeetingPoint(@PathVariable Integer groupId, @RequestBody @Valid MeetingPointDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(meetingPointService.setMeetingPoint((Integer) session.getAttribute("userId"), groupId, input));
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<?> getGroupMeetingPoint(@PathVariable Integer groupId, HttpSession session) {
        return ResponseEntity.status(200).body(meetingPointService.getGroupMeetingPoint((Integer) session.getAttribute("userId"), groupId));
    }

    @DeleteMapping("/group/{groupId}")
    public ResponseEntity<?> deleteMeetingPoint(@PathVariable Integer groupId, HttpSession session) {
        meetingPointService.deleteMeetingPoint((Integer) session.getAttribute("userId"), groupId);
        return ResponseEntity.status(200).body(new ApiResponse("Meeting point deleted successfully"));
    }
}
