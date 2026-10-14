package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserLocationDtoOut {

    private Integer userId;

    private String name;

    private Double latitude;

    private Double longitude;

    private Double accuracy;

    private OffsetDateTime recordedAt;

    private Boolean sharingEnabled;

    // Null for ALWAYS; exact visibility cutoff for SCHEDULED or WHILE_USING.
    private OffsetDateTime visibleUntil;

    public UserLocationDtoOut(Integer userId, String name, Double latitude, Double longitude, Double accuracy, OffsetDateTime recordedAt, Boolean sharingEnabled) {
        this.userId = userId;
        this.name = name;
        this.latitude = latitude;
        this.longitude = longitude;
        this.accuracy = accuracy;
        this.recordedAt = recordedAt;
        this.sharingEnabled = sharingEnabled;
    }
}
