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

    // Null is explicitly unbounded only for ALWAYS; finite for other modes.
    @com.fasterxml.jackson.annotation.JsonInclude(com.fasterxml.jackson.annotation.JsonInclude.Include.ALWAYS)
    @com.fasterxml.jackson.annotation.JsonFormat(shape = com.fasterxml.jackson.annotation.JsonFormat.Shape.STRING)
    private OffsetDateTime visibleUntil;

    public UserLocationDtoOut(Integer userId, String name, Double latitude, Double longitude, Double accuracy, OffsetDateTime recordedAt, Boolean sharingEnabled) {
        this(userId, name, latitude, longitude, accuracy, recordedAt, sharingEnabled, null);
    }
}
