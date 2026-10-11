package com.example.dal.DtoIn;

import jakarta.validation.constraints.*;
import lombok.*;
import java.time.OffsetDateTime;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
public class PauseDtoIn {

    private OffsetDateTime pausedUntil;
}
