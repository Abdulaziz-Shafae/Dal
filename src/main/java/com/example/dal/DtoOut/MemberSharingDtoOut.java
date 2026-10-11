package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class MemberSharingDtoOut {

    private Integer groupId;

    private Boolean isPaused;

    private OffsetDateTime pausedUntil;

    private Boolean sharingEnabled;
}
