package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class GroupJoinRequestDtoOut {

    private Integer id;

    private Integer groupId;

    private String groupName;

    private Integer userId;

    private String userName;

    private String status;

    private OffsetDateTime requestedAt;

    private OffsetDateTime reviewedAt;

    private Integer reviewedById;
}
