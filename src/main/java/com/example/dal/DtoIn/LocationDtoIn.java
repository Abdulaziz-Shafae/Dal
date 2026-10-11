package com.example.dal.DtoIn;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class LocationDtoIn {

    @NotNull(message = "Latitude is required")
    @DecimalMin(value = "-90", message = "Latitude must be at least -90")
    @DecimalMax(value = "90", message = "Latitude must not exceed 90")
    private Double latitude;

    @NotNull(message = "Longitude is required")
    @DecimalMin(value = "-180", message = "Longitude must be at least -180")
    @DecimalMax(value = "180", message = "Longitude must not exceed 180")
    private Double longitude;

    @PositiveOrZero(message = "Accuracy must not be negative")
    private Double accuracy;

    @NotNull(message = "Recorded time is required")
    private OffsetDateTime recordedAt;
}
