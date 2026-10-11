package com.example.dal.Config;

import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class WebConfig implements WebMvcConfigurer {

    private final SessionValidationInterceptor sessionValidationInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(sessionValidationInterceptor).addPathPatterns("/api/v1/**").excludePathPatterns("/api/v1/user/register", "/api/v1/user/login", "/api/v1/password-reset/request", "/api/v1/password-reset/confirm", "/api/v1/security/csrf");
    }
}
