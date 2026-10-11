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
}
