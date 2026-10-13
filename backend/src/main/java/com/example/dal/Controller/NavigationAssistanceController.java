package com.example.dal.Controller;

import com.example.dal.DtoIn.NavigationRequest.*;
import com.example.dal.Service.NavigationAssistanceService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/navigation/group/{groupId}")
public class NavigationAssistanceController {
    private final NavigationAssistanceService service;
    @PostMapping("/walking") public ResponseEntity<?> walking(@PathVariable Integer groupId,@RequestBody @Valid Destination input,HttpSession session) {return ResponseEntity.ok(service.walking((Integer)session.getAttribute("userId"),groupId,input));}
    @PostMapping("/reunion-assistance") public ResponseEntity<?> reunion(@PathVariable Integer groupId,@RequestBody @Valid Destination input,HttpSession session) {return ResponseEntity.ok(service.reunion((Integer)session.getAttribute("userId"),groupId,input));}
    @PostMapping("/meeting-suggestions") public ResponseEntity<?> meeting(@PathVariable Integer groupId,@RequestBody @Valid Candidates input,HttpSession session) {return ResponseEntity.ok(service.suggest((Integer)session.getAttribute("userId"),groupId,input));}
}
