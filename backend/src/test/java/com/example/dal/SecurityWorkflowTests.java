package com.example.dal;

import com.example.dal.DtoIn.*;
import com.example.dal.Service.*;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@IsolatedDalContext
@Transactional
class SecurityWorkflowTests {

    @Autowired WebApplicationContext context;
    @Autowired UserService users;
    @Autowired PasswordResetService resets;
    @MockitoBean BrevoEmailService emailService;
    private MockMvc mvc;

    @BeforeEach
    void configureSecurityRequests() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private String getSessionCsrfToken(MockHttpSession session) throws Exception {
        String body = mvc.perform(get("/api/v1/security/csrf").session(session)).andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store")).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    @Test
    void missingCsrfRejectsRegistrationBeforeDatabaseWrite() throws Exception {
        mvc.perform(post("/api/v1/user/register").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"CSRF user\",\"email\":\"missing-csrf@example.com\",\"password\":\"ValidPass1!\"}")).andExpect(status().isForbidden()).andExpect(jsonPath("$.message").value("Invalid or missing CSRF token. Fetch a new token and try again"));
    }

    @Test
    void browserTokenAllowsRegistrationOnlyInItsOwnSession() throws Exception {
        MockHttpSession session = new MockHttpSession();
        String token = getSessionCsrfToken(session);
        String body = "{\"name\":\"CSRF user\",\"email\":\"valid-csrf@example.com\",\"password\":\"ValidPass1!\"}";
        mvc.perform(post("/api/v1/user/register").session(new MockHttpSession()).header("X-CSRF-TOKEN", token).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/user/register").session(session).header("X-CSRF-TOKEN", token).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isCreated());
    }

    @Test
    void tokenDoesNotReplaceAuthentication() throws Exception {
        MockHttpSession session = new MockHttpSession();
        String token = getSessionCsrfToken(session);
        mvc.perform(put("/api/v1/sharing/resume").session(session).header("X-CSRF-TOKEN", token)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Please log in first"));
    }

    @Test
    void allowedCorsPreflightIncludesCredentialsAndRejectedOriginIsBlocked() throws Exception {
        mvc.perform(options("/api/v1/user/login").header("Origin", "http://localhost:5173").header("Access-Control-Request-Method", "POST").header("Access-Control-Request-Headers", "content-type,x-csrf-token")).andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173")).andExpect(header().string("Access-Control-Allow-Credentials", "true"));
        mvc.perform(options("/api/v1/user/login").header("Origin", "https://untrusted.example").header("Access-Control-Request-Method", "POST")).andExpect(status().isForbidden()).andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
    }

    @Test
    void passwordResetInvalidatesAllOldSessionsOnTheirNextRequest() throws Exception {
        String email = UUID.randomUUID() + "@example.com";
        users.registerUser(new RegisterUserDtoIn("Session user", email, "ValidPass1!"));
        MockHttpSession first = new MockHttpSession();
        MockHttpSession second = new MockHttpSession();
        for (MockHttpSession session : new MockHttpSession[]{first, second}) {
            String csrf = getSessionCsrfToken(session);
            mvc.perform(post("/api/v1/user/login").session(session).header("X-CSRF-TOKEN", csrf).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\",\"password\":\"ValidPass1!\"}")).andExpect(status().isOk());
        }
        resets.requestPasswordReset(new PasswordResetRequestDtoIn(email));
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendPasswordResetEmail(eq(email), link.capture());
        String raw = link.getValue().substring(link.getValue().indexOf("token=") + 6);
        resets.confirmPasswordReset(new PasswordResetConfirmDtoIn(raw, "NewValidPass2!"));
        for (MockHttpSession session : new MockHttpSession[]{first, second}) {
            mvc.perform(get("/api/v1/user/profile").session(session)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Your session has expired. Please log in again"));
            assertTrue(session.isInvalid());
        }
        MockHttpSession fresh = new MockHttpSession();
        String csrf = getSessionCsrfToken(fresh);
        mvc.perform(post("/api/v1/user/login").session(fresh).header("X-CSRF-TOKEN", csrf).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\",\"password\":\"NewValidPass2!\"}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/user/profile").session(fresh)).andExpect(status().isOk()).andExpect(jsonPath("$.credentialFingerprint").doesNotExist());
    }

    @Test
    void forgedSessionUserIdWithoutCredentialFingerprintIsRejected() throws Exception {
        var user = users.registerUser(new RegisterUserDtoIn("Session user", UUID.randomUUID() + "@example.com", "ValidPass1!"));
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("userId", user.getId());
        mvc.perform(get("/api/v1/user/profile").session(session)).andExpect(status().isBadRequest());
        assertTrue(session.isInvalid());
    }
}
