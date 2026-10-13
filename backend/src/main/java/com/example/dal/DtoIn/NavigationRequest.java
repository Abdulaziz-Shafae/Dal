package com.example.dal.DtoIn;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.List;

public final class NavigationRequest {
    private NavigationRequest() {}
    public record Destination(@Positive Integer memberId, boolean meetingPoint) {}
    public record Candidate(@NotBlank @Size(max=100) String name,
                            @NotNull @DecimalMin("-90") @DecimalMax("90") Double latitude,
                            @NotNull @DecimalMin("-180") @DecimalMax("180") Double longitude) {}
    public record Candidates(@NotNull @Size(min=1, max=3) List<@Valid Candidate> candidates) {}
}
