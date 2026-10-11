package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.*;
import com.example.dal.DtoOut.UserDtoOut;
import com.example.dal.Model.*;
import com.example.dal.Repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final LocationSharingSettingsRepository settingsRepository;
    private final PasswordResetTokenRepository tokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final PasswordPolicyService passwordPolicyService;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;

    @Transactional
    public UserDtoOut registerUser(RegisterUserDtoIn input) {
        validationService.validateInput(input);
        passwordPolicyService.validatePassword(input.getPassword());
        String email = normalizeEmail(input.getEmail());
        if (userRepository.existsByEmailIgnoreCase(email)) {
            throw new ApiException("Email is already registered");
        }
        User user = new User();
        user.setName(input.getName().trim());
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(input.getPassword()));
        userRepository.saveAndFlush(user);
        LocationSharingSettings settings = new LocationSharingSettings();
        settings.setUser(user);
        settingsRepository.save(settings);
        return createUserResponse(user);
    }

    @Transactional(readOnly = true)
    public Integer loginUser(LoginDtoIn input) {
        validationService.validateInput(input);
        User user = userRepository.findUserByEmailIgnoreCase(normalizeEmail(input.getEmail()));
        if (user == null || !passwordEncoder.matches(input.getPassword(), user.getPassword())) {
            throw new ApiException("Invalid email or password");
        }
        return user.getId();
    }

    // The Controller invalidates HttpSession after this check; services never receive HttpSession.
    @Transactional(readOnly = true)
    public void validateLogout(Integer userId) {
        accessService.requireUser(userId);
    }

    @Transactional(readOnly = true)
    public UserDtoOut getUserProfile(Integer userId) {
        return createUserResponse(accessService.requireUser(userId));
    }

    @Transactional
    public UserDtoOut updateUserProfile(Integer userId, UpdateProfileDtoIn input) {
        validationService.validateInput(input);
        User user = accessService.requireUserForUpdate(userId);
        String email = normalizeEmail(input.getEmail());
        User existing = userRepository.findUserByEmailIgnoreCase(email);
        if (existing != null && !existing.getId().equals(userId)) {
            throw new ApiException("Email is already registered");
        }
        if (!email.equals(user.getEmail())) {
            for (PasswordResetToken token : tokenRepository.findAllByUser_IdAndUsedAtIsNull(userId)) {
                token.setUsedAt(validationService.getCurrentTime());
            }
        }
        user.setName(input.getName().trim());
        user.setEmail(email);
        userRepository.saveAndFlush(user);
        return createUserResponse(user);
    }

    public String normalizeEmail(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    private UserDtoOut createUserResponse(User user) {
        return new UserDtoOut(user.getId(), user.getName(), user.getEmail(), validationService.convertForResponse(user.getCreatedAt()));
    }
}
