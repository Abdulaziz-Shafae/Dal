package com.example.dal.DtoOut;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class UserDtoOut {

    private Integer id;

    private String name;

    private String email;

    private OffsetDateTime createdAt;
}
