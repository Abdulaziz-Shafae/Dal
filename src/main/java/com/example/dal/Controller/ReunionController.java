package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.ReunionService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/reunion")
public class ReunionController {

    private final ReunionService reunionService;

    @PostMapping("/group/{groupId}/arrived/{targetUserId}")
    public ResponseEntity<?> recordArrival(@PathVariable Integer groupId, @PathVariable Integer targetUserId, HttpSession session) {
        return ResponseEntity.status(200).body(reunionService.recordArrival((Integer) session.getAttribute("userId"), groupId, targetUserId));
    }
}
