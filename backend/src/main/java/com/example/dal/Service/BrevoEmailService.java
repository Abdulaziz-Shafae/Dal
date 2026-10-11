package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import java.util.List;
import java.util.Map;

@Service
public class BrevoEmailService {

    @Value("${brevo.api-key:}")
    private String apiKey;

    @Value("${brevo.sender-email:dal.support.sa@gmail.com}")
    private String senderEmail;

    @Value("${brevo.sender-name:Dal}")
    private String senderName;

    private final RestClient restClient;

    public BrevoEmailService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(10000);
        factory.setReadTimeout(15000);
        restClient = RestClient.builder().baseUrl("https://api.brevo.com/v3").requestFactory(factory).build();
    }

    public void sendPasswordResetEmail(String email, String resetLink) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new ApiException("Password reset email is not configured");
        }
        String content = "Use this link to reset your Dal password:\n\n" + resetLink + "\n\nThis link expires in 24 hours and can be used only once. If you did not request this, ignore this email.";
        Map<String, Object> body = Map.of("sender", Map.of("email", senderEmail, "name", senderName), "to", List.of(Map.of("email", email)), "subject", "Reset your Dal password", "textContent", content);
        try {
            restClient.post().uri("/smtp/email").header("api-key", apiKey).contentType(MediaType.APPLICATION_JSON).body(body).retrieve().toBodilessEntity();
        } catch (RestClientException e) {
            throw new ApiException("Unable to send the password reset email. Please try again later");
        }
    }
}
