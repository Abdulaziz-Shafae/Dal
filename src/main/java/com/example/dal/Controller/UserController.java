package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/user")
public class UserController {

    private final UserService userService;

    @PostMapping("/register")
    public ResponseEntity<?> registerUser(@RequestBody @Valid RegisterUserDtoIn input) {
        return ResponseEntity.status(201).body(userService.registerUser(input));
    }

    @PostMapping("/login")
    public ResponseEntity<?> loginUser(@RequestBody @Valid LoginDtoIn input, HttpServletRequest request) {
        Integer userId = userService.loginUser(input);
        HttpSession session = request.getSession(true);
        request.changeSessionId();
        session.setAttribute("userId", userId);
        return ResponseEntity.status(200).body(userService.getUserProfile(userId));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logoutUser(HttpSession session) {
        userService.validateLogout((Integer) session.getAttribute("userId"));
        session.invalidate();
        return ResponseEntity.status(200).body(new ApiResponse("Logged out successfully"));
    }

    @GetMapping("/profile")
    public ResponseEntity<?> getUserProfile(HttpSession session) {
        return ResponseEntity.status(200).body(userService.getUserProfile((Integer) session.getAttribute("userId")));
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateUserProfile(@RequestBody @Valid UpdateProfileDtoIn input, HttpSession session) {
        return ResponseEntity.status(200).body(userService.updateUserProfile((Integer) session.getAttribute("userId"), input));
    }
}
