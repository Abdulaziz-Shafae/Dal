package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class NotificationDtoOut {

    private Integer id;

    private Integer groupId;

    private Integer senderId;

    private String senderName;

    private String type;

    private String content;

    private OffsetDateTime createdAt;

    private OffsetDateTime readAt;
}
