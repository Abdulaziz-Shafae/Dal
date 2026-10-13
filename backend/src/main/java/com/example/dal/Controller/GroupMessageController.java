package com.example.dal.Controller;

import com.example.dal.DtoIn.SendMessageDtoIn;
import com.example.dal.Service.GroupMessageService;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController @RequiredArgsConstructor @RequestMapping("/api/v1/group-message/group/{groupId}")
public class GroupMessageController {
    private final GroupMessageService service;
    @PostMapping public ResponseEntity<?> send(@PathVariable Integer groupId,@RequestBody @Valid SendMessageDtoIn input,HttpSession session) {return ResponseEntity.ok(service.send((Integer)session.getAttribute("userId"),groupId,input));}
    @GetMapping public ResponseEntity<?> conversation(@PathVariable Integer groupId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size,HttpSession session) {return ResponseEntity.ok(service.conversation((Integer)session.getAttribute("userId"),groupId,page,size));}
    @PutMapping("/read/{messageId}") public ResponseEntity<?> read(@PathVariable Integer groupId,@PathVariable Integer messageId,HttpSession session) {service.read((Integer)session.getAttribute("userId"),groupId,messageId);return ResponseEntity.ok(Map.of("message","Group messages marked read"));}
    @GetMapping("/unread-count") public ResponseEntity<?> unread(@PathVariable Integer groupId,HttpSession session) {return ResponseEntity.ok(Map.of("count",service.unread((Integer)session.getAttribute("userId"),groupId)));}
}
