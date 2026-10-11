package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.Api.ApiResponse;
import com.example.dal.DtoIn.*;
import com.example.dal.Model.*;
import com.example.dal.Repository.*;
import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class PasswordResetService {

    private final EntityManager entityManager;
    private final UserRepository userRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;
    private final PasswordPolicyService passwordPolicyService;
    private final PasswordEncoder passwordEncoder;
    private final BrevoEmailService emailService;
    private final SecureRandom secureRandom = new SecureRandom();

    @Value("${password.reset-url:}")
    private String resetUrl;

    @Transactional
    public ApiResponse requestPasswordReset(PasswordResetRequestDtoIn input) {
        validationService.validateInput(input);
        User user = userRepository.findUserByEmailIgnoreCase(input.getEmail().trim().toLowerCase(Locale.ROOT));
        ApiResponse response = new ApiResponse("If the email is registered, you will receive a password reset link");
        if (user == null) {
            return response;
        }
        user = accessService.requireUserForUpdate(user.getId());
        if (!user.getEmail().equalsIgnoreCase(input.getEmail().trim())) {
            return response;
        }
        LocalDateTime now = validationService.getCurrentTime();
        var existingTokens = tokenRepository.findAllByUser_IdAndUsedAtIsNull(user.getId());
        if (existingTokens.stream().anyMatch(t -> t.getCreatedAt().isAfter(now.minusMinutes(1)))) {
            return response;
        }
        validateResetUrl();
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String rawToken = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        for (PasswordResetToken existing : existingTokens) {
            existing.setUsedAt(now);
        }
        PasswordResetToken token = new PasswordResetToken();
        token.setUser(user);
        token.setTokenHash(hashToken(rawToken));
        token.setExpiresAt(now.plusHours(24));
        tokenRepository.saveAndFlush(token);
        String separator = resetUrl.contains("?") ? "&" : "?";
        emailService.sendPasswordResetEmail(user.getEmail(), resetUrl + separator + "token=" + rawToken);
        return response;
    }

    @Transactional
    public void confirmPasswordReset(PasswordResetConfirmDtoIn input) {
        validationService.validateInput(input);
        if (!input.getToken().matches("[A-Za-z0-9_-]{43}")) {
            throw new ApiException("Invalid or expired password reset link");
        }
        String hash = hashToken(input.getToken());
        PasswordResetToken token = tokenRepository.findByTokenHash(hash);
        if (token == null) {
            throw new ApiException("Invalid or expired password reset link");
        }
        User user = accessService.requireUserForUpdate(token.getUser().getId());
        // Refresh after the user lock: two simultaneous submissions must not reuse the token.
        entityManager.refresh(token);
        LocalDateTime now = validationService.getCurrentTime();
        if (token.getUsedAt() != null || !token.getExpiresAt().isAfter(now)) {
            throw new ApiException("Invalid or expired password reset link");
        }
        passwordPolicyService.validatePassword(input.getNewPassword());
        user.setPassword(passwordEncoder.encode(input.getNewPassword()));
        userRepository.save(user);
        for (PasswordResetToken existing : tokenRepository.findAllByUser_IdAndUsedAtIsNull(user.getId())) {
            existing.setUsedAt(now);
        }
    }

    private String hashToken(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private void validateResetUrl() {
        try {
            URI uri = URI.create(resetUrl);
            if (!"https".equalsIgnoreCase(uri.getScheme()) && !"http".equalsIgnoreCase(uri.getScheme())) {
                throw new IllegalArgumentException();
            }
            if (uri.getHost() == null || uri.getFragment() != null) {
                throw new IllegalArgumentException();
            }
        } catch (IllegalArgumentException e) {
            throw new ApiException("Password reset page URL is not configured");
        }
    }
}
