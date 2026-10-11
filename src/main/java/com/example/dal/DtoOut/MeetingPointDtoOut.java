package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class MeetingPointDtoOut {

    private Integer id;

    private Integer groupId;

    private String name;

    private Double latitude;

    private Double longitude;

    private Integer createdById;

    private OffsetDateTime createdAt;

    private OffsetDateTime updatedAt;
}
