package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class GroupMemberDtoOut {

    private Integer id;

    private Integer userId;

    private String name;

    private String role;

    private Boolean locationSharingPaused;

    private OffsetDateTime locationSharingPausedUntil;

    private OffsetDateTime joinedAt;
}
