package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class GroupDtoOut {

    private Integer id;

    private String name;

    private String joinCode;

    private String status;

    private String joinMode;

    private Integer createdById;

    private String myRole;

    private Long memberCount;

    private OffsetDateTime pausedUntil;

    private OffsetDateTime createdAt;
}
