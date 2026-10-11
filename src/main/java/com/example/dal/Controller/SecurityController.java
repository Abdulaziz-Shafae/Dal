package com.example.dal.Controller;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/security")
public class SecurityController {

    @GetMapping("/csrf")
    public ResponseEntity<?> getCsrfToken(CsrfToken token) {
        return ResponseEntity.status(200).cacheControl(CacheControl.noStore()).body(Map.of("token", token.getToken(), "headerName", token.getHeaderName()));
    }
}
