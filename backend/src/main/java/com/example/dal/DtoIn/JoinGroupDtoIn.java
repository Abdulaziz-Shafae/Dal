package com.example.dal.DtoIn;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class JoinGroupDtoIn {

    @NotBlank(message = "Join code is required")
    @Pattern(regexp = "[A-Za-z0-9]{5}", message = "Join code must contain exactly 5 letters or numbers")
    private String joinCode;
}
