package com.example.dal.Controller;

import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.PasswordResetConfirmDtoIn;
import com.example.dal.DtoIn.PasswordResetRequestDtoIn;
import com.example.dal.Service.PasswordResetService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/password-reset")
public class PasswordResetController {

    private final PasswordResetService passwordResetService;

    @PostMapping("/request")
    public ResponseEntity<?> requestPasswordReset(@RequestBody @Valid PasswordResetRequestDtoIn input) {
        return ResponseEntity.status(200).body(passwordResetService.requestPasswordReset(input));
    }

    @PostMapping("/confirm")
    public ResponseEntity<?> confirmPasswordReset(@RequestBody @Valid PasswordResetConfirmDtoIn input) {
        passwordResetService.confirmPasswordReset(input);
        return ResponseEntity.status(200).body(new ApiResponse("Password reset successfully. Please log in with your new password"));
    }
}
