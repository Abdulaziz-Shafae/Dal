package com.example.dal.DtoIn;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class GroupDtoIn {

    @NotBlank(message = "Group name is required")
    @Size(max = 100, message = "Group name must not exceed 100 characters")
    private String name;

    @NotBlank(message = "Join mode is required")
    @Pattern(regexp = "DIRECT|APPROVAL", message = "Join mode must be DIRECT or APPROVAL")
    private String joinMode;
}
