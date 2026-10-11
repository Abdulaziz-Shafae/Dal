package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class MessageDtoOut {

    private Integer id;

    private Integer groupId;

    private Integer senderId;

    private String senderName;

    private Integer receiverId;

    private String content;

    private String clientMessageId;

    private OffsetDateTime createdAt;

    private OffsetDateTime readAt;
}
