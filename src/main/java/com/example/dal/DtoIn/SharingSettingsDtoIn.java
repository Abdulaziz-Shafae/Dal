package com.example.dal.DtoIn;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class SharingSettingsDtoIn {

    @NotBlank(message = "Sharing mode is required")
    @Pattern(regexp = "SCHEDULED|WHILE_USING|ALWAYS", message = "Sharing mode must be SCHEDULED, WHILE_USING, or ALWAYS")
    private String sharingMode;

    private OffsetDateTime startTime;

    private OffsetDateTime endTime;

    @NotNull(message = "Update interval is required")
    @Min(value = 1, message = "Update interval must be at least 1 second")
    private Integer updateIntervalSeconds;
}
