package com.example.dal.DtoIn;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class SendMessageDtoIn {

    @NotBlank(message = "Message is required")
    @Size(max = 1000, message = "Message must not exceed 1000 characters")
    private String content;

    @NotBlank(message = "Client message ID is required")
    @Pattern(regexp = "[A-Za-z0-9_-]{1,64}", message = "Client message ID must contain 1 to 64 letters, numbers, underscores, or hyphens")
    private String clientMessageId;
}
