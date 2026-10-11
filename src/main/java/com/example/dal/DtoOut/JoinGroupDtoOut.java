package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class JoinGroupDtoOut {

    private Integer groupId;

    private Integer requestId;

    private String status;

    private String message;
}
