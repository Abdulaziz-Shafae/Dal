package com.example.dal.DtoIn;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class NudgeDtoIn {

    @NotBlank(message = "Nudge message is required")
    @Pattern(regexp = "WHERE_ARE_YOU|ON_MY_WAY", message = "Nudge must be WHERE_ARE_YOU or ON_MY_WAY")
    private String message;
}
