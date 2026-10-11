package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.GroupService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/group")
public class GroupController {

    private final GroupService groupService;

    @PostMapping("/create")
    public ResponseEntity<?> createGroup(@RequestBody @Valid GroupDtoIn input, HttpSession session) {
        return ResponseEntity.status(201).body(groupService.createGroup((Integer) session.getAttribute("userId"), input));
    }

    @GetMapping("/my")
    public ResponseEntity<?> getMyGroups(HttpSession session) {
        return ResponseEntity.status(200).body(groupService.getMyGroups((Integer) session.getAttribute("userId")));
    }

    @GetMapping("/{groupId}")
    public ResponseEntity<?> getGroupDetails(@PathVariable Integer groupId, HttpSession session) {
        return ResponseEntity.status(200).body(groupService.getGroupDetails((Integer) session.getAttribute("userId"), groupId));
    }

    @PutMapping("/{groupId}")
    public ResponseEntity<?> updateGroup(@PathVariable Integer groupId, @RequestBody @Valid GroupDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(groupService.updateGroup((Integer) session.getAttribute("userId"), groupId, input));
    }

    @PostMapping("/join")
    public ResponseEntity<?> joinGroup(@RequestBody @Valid JoinGroupDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(groupService.joinGroup((Integer) session.getAttribute("userId"), input));
    }

    @PutMapping("/{groupId}/pause")
    public ResponseEntity<?> pauseGroup(@PathVariable Integer groupId, @RequestBody @Valid PauseDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(groupService.pauseGroup((Integer) session.getAttribute("userId"), groupId, input));
    }

    @PutMapping("/{groupId}/resume")
    public ResponseEntity<?> resumeGroup(@PathVariable Integer groupId, HttpSession session) {
        return ResponseEntity.status(200).body(groupService.resumeGroup((Integer) session.getAttribute("userId"), groupId));
    }

    @PutMapping("/{groupId}/close")
    public ResponseEntity<?> closeGroup(@PathVariable Integer groupId, HttpSession session) {
        groupService.closeGroup((Integer) session.getAttribute("userId"), groupId);
        return ResponseEntity.status(200).body(new ApiResponse("Group closed successfully"));
    }

    @PutMapping("/{groupId}/join-code")
    public ResponseEntity<?> regenerateJoinCode(@PathVariable Integer groupId, HttpSession session) {
        return ResponseEntity.status(200).body(groupService.regenerateJoinCode((Integer) session.getAttribute("userId"), groupId));
    }

    @PutMapping("/{groupId}/owner/{memberId}")
    public ResponseEntity<?> transferGroupOwnership(@PathVariable Integer groupId, @PathVariable Integer memberId, HttpSession session) {
        groupService.transferGroupOwnership((Integer) session.getAttribute("userId"), groupId, memberId);
        return ResponseEntity.status(200).body(new ApiResponse("Group ownership transferred successfully"));
    }
}
