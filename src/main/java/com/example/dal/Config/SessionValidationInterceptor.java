package com.example.dal.Config;

import com.example.dal.Api.ApiException;
import com.example.dal.Service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
@RequiredArgsConstructor
public class SessionValidationInterceptor implements HandlerInterceptor {

    private final UserService userService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if ("OPTIONS".equals(request.getMethod())) {
            return true;
        }
        HttpSession session = request.getSession(false);
        if (session == null || !(session.getAttribute("userId") instanceof Integer userId)) {
            throw new ApiException("Please log in first");
        }
        Object fingerprint = session.getAttribute("credentialFingerprint");
        if (!(fingerprint instanceof String version) || !userService.isSessionCredentialCurrent(userId, version)) {
            session.invalidate();
            throw new ApiException("Your session has expired. Please log in again");
        }
        return true;
    }
}
