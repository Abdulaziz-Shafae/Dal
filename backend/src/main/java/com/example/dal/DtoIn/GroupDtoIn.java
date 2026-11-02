package com.example.dal.DtoIn;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;
import java.time.LocalDate;
import java.time.LocalTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class GroupDtoIn {

    @NotBlank(message = "Group name is required")
    @Size(max = 100, message = "Group name must not exceed 100 characters")
    private String name;

    @NotBlank(message = "Join mode is required")
    @Pattern(regexp = "DIRECT|APPROVAL", message = "Join mode must be DIRECT or APPROVAL")
    private String joinMode;

    private String scheduleMode;
    private LocalDate eventStartDate;
    private LocalDate eventEndDate;
    private LocalTime dailyStartTime;
    private LocalTime dailyEndTime;
}
