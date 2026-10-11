package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import jakarta.validation.Validator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;

@Service
@RequiredArgsConstructor
public class InputValidationService {

    private final Validator validator;
    private final Clock clock;

    public void validateInput(Object input) {
        if (input == null) {
            throw new ApiException("Request body is required");
        }
        var errors = validator.validate(input);
        if (!errors.isEmpty()) {
            var error = errors.stream().sorted(Comparator.comparing(e -> e.getPropertyPath().toString() + e.getMessage())).findFirst().orElseThrow();
            throw new ApiException(error.getMessage());
        }
    }

    public LocalDateTime getCurrentTime() {
        return LocalDateTime.now(clock);
    }

    public LocalDateTime convertToUtc(OffsetDateTime dateTime) {
        return dateTime == null ? null : dateTime.withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
    }

    public OffsetDateTime convertForResponse(LocalDateTime dateTime) {
        return dateTime == null ? null : dateTime.atOffset(ZoneOffset.UTC);
    }

    public LocalDateTime validatePauseUntil(OffsetDateTime pausedUntil) {
        LocalDateTime value = convertToUtc(pausedUntil);
        if (value != null && !value.isAfter(getCurrentTime())) {
            throw new ApiException("Pause end time must be in the future");
        }
        return value;
    }

    public void validatePagination(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException("Page must be non-negative and size must be between 1 and 100");
        }
    }
}
