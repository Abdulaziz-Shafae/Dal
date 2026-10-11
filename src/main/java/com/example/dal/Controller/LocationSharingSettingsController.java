package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.LocationSharingSettingsService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/sharing")
public class LocationSharingSettingsController {

    private final LocationSharingSettingsService locationSharingSettingsService;

    @GetMapping("")
    public ResponseEntity<?> getSharingSettings(HttpSession session) {
        return ResponseEntity.status(200).body(locationSharingSettingsService.getSharingSettings((Integer) session.getAttribute("userId")));
    }

    @PutMapping("")
    public ResponseEntity<?> updateSharingSettings(@RequestBody @Valid SharingSettingsDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(locationSharingSettingsService.updateSharingSettings((Integer) session.getAttribute("userId"), input));
    }

    @PutMapping("/pause")
    public ResponseEntity<?> pauseAllLocationSharing(@RequestBody @Valid PauseDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(locationSharingSettingsService.pauseAllLocationSharing((Integer) session.getAttribute("userId"), input));
    }

    @PutMapping("/resume")
    public ResponseEntity<?> resumeAllLocationSharing(HttpSession session) {
        return ResponseEntity.status(200).body(locationSharingSettingsService.resumeAllLocationSharing((Integer) session.getAttribute("userId")));
    }

    @GetMapping("/group/{groupId}")
    public ResponseEntity<?> getSharingForGroup(@PathVariable Integer groupId, HttpSession session) {
        return ResponseEntity.status(200).body(locationSharingSettingsService.getSharingForGroup((Integer) session.getAttribute("userId"), groupId));
    }

    @PutMapping("/group/{groupId}/pause")
    public ResponseEntity<?> pauseSharingForGroup(@PathVariable Integer groupId, @RequestBody @Valid PauseDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(locationSharingSettingsService.pauseSharingForGroup((Integer) session.getAttribute("userId"), groupId, input));
    }

    @PutMapping("/group/{groupId}/resume")
    public ResponseEntity<?> resumeSharingForGroup(@PathVariable Integer groupId, HttpSession session) {
        return ResponseEntity.status(200).body(locationSharingSettingsService.resumeSharingForGroup((Integer) session.getAttribute("userId"), groupId));
    }
}
