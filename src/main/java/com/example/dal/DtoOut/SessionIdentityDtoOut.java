package com.example.dal.DtoOut;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public class SessionIdentityDtoOut {

    private final Integer userId;
    private final String credentialFingerprint;
}
