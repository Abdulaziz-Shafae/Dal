package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.UserLocationService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/location")
public class UserLocationController {

    private final UserLocationService userLocationService;

    @PostMapping("/update")
    public ResponseEntity<?> updateUserLocation(@RequestBody @Valid LocationDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(userLocationService.updateUserLocation((Integer) session.getAttribute("userId"), input));
    }

    @PostMapping("/group/{groupId}/active")
    public ResponseEntity<?> recordWhileUsingActivity(@PathVariable Integer groupId, HttpSession session) {
        userLocationService.recordWhileUsingActivity((Integer) session.getAttribute("userId"), groupId);
        return ResponseEntity.status(200).body(new ApiResponse("Location activity recorded"));
    }

    @GetMapping("/my")
    public ResponseEntity<?> getMyLatestLocation(HttpSession session) {
        return ResponseEntity.status(200).body(userLocationService.getMyLatestLocation((Integer) session.getAttribute("userId")));
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<?> getGroupLocations(@PathVariable Integer groupId, HttpSession session) {
        return ResponseEntity.status(200).body(userLocationService.getGroupLocations((Integer) session.getAttribute("userId"), groupId));
    }

    @DeleteMapping("/my/history")
    public ResponseEntity<?> deleteMyLocationHistory(HttpSession session) {
        userLocationService.deleteMyLocationHistory((Integer) session.getAttribute("userId"));
        return ResponseEntity.status(200).body(new ApiResponse("Location history deleted successfully"));
    }
}
