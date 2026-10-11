package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.GroupMemberService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/group-member")
public class GroupMemberController {

    private final GroupMemberService groupMemberService;

    @GetMapping("/group/{groupId}")
    public ResponseEntity<?> getGroupMembers(@PathVariable Integer groupId, HttpSession session) {
        return ResponseEntity.status(200).body(groupMemberService.getGroupMembers((Integer) session.getAttribute("userId"), groupId));
    }

    @DeleteMapping("/group/{groupId}/leave")
    public ResponseEntity<?> leaveGroup(@PathVariable Integer groupId, HttpSession session) {
        groupMemberService.leaveGroup((Integer) session.getAttribute("userId"), groupId);
        return ResponseEntity.status(200).body(new ApiResponse("Left the group successfully"));
    }

    @PutMapping("/{memberId}/role")
    public ResponseEntity<?> updateMemberRole(@PathVariable Integer memberId, @RequestBody @Valid MemberRoleDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(groupMemberService.updateMemberRole((Integer) session.getAttribute("userId"), memberId, input));
    }

    @DeleteMapping("/{memberId}")
    public ResponseEntity<?> removeGroupMember(@PathVariable Integer memberId, HttpSession session) {
        groupMemberService.removeGroupMember((Integer) session.getAttribute("userId"), memberId);
        return ResponseEntity.status(200).body(new ApiResponse("Group member removed successfully"));
    }
}
