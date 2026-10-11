package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class ReunionDtoOut {

    private Integer id;

    private Integer groupId;

    private Integer userId;

    private Integer targetUserId;

    private OffsetDateTime arrivedAt;
}
