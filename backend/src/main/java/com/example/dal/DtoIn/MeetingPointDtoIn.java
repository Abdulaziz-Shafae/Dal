package com.example.dal.DtoIn;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class MeetingPointDtoIn {

    @NotBlank(message = "Meeting point name is required")
    @Size(max = 100, message = "Name must not exceed 100 characters")
    private String name;

    @NotNull(message = "Latitude is required")
    @DecimalMin("-90")
    @DecimalMax("90")
    private Double latitude;

    @NotNull(message = "Longitude is required")
    @DecimalMin("-180")
    @DecimalMax("180")
    private Double longitude;
}
