package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class PasswordPolicyService {

    public void validatePassword(String password) {
        if (password == null || password.isBlank()) {
            throw new ApiException("Password is required");
        }
        List<String> errors = new ArrayList<>();
        if (password.length() < 8) {
            errors.add("Password must contain at least 8 characters");
        }
        if (!password.matches("(?s).*[A-Z].*")) {
            errors.add("Password is missing an uppercase letter");
        }
        if (!password.matches("(?s).*[a-z].*")) {
            errors.add("Password is missing a lowercase letter");
        }
        if (!password.matches("(?s).*[0-9].*")) {
            errors.add("Password is missing a number");
        }
        if (!password.matches("(?s).*[\\p{P}\\p{S}].*")) {
            errors.add("Password is missing a symbol");
        }
        if (password.getBytes(StandardCharsets.UTF_8).length > 72) {
            errors.add("Password must not exceed 72 UTF-8 bytes");
        }
        if (!errors.isEmpty()) {
            throw new ApiException(String.join("; ", errors));
        }
    }
}
