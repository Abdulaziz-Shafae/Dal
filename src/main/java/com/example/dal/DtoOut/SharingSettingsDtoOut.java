package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class SharingSettingsDtoOut {

    private String sharingMode;

    private OffsetDateTime startTime;

    private OffsetDateTime endTime;

    private Boolean isPaused;

    private OffsetDateTime pausedUntil;

    private Integer updateIntervalSeconds;

    private Boolean sharingEnabled;

    private OffsetDateTime updatedAt;
}
