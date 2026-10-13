package com.example.dal;

import com.example.dal.DtoIn.RegisterUserDtoIn;
import com.example.dal.DtoOut.UserDtoOut;
import com.example.dal.Service.BrevoEmailService;
import com.example.dal.Service.UserService;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;
import java.util.Arrays;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import com.example.dal.DtoIn.LoginDtoIn;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@IsolatedDalContext
@Transactional
class ControllerWorkflowTests {

    @Autowired WebApplicationContext context;
    @Autowired UserService users;
    @Autowired com.example.dal.Service.GroupService groups;
    @Autowired RequestMappingHandlerMapping mappings;
    @MockitoBean BrevoEmailService emailService;
    private MockMvc mvc;

    @BeforeEach
    void configureHttpRequests() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
    }

    private UserDtoOut registerTestUser() {
        return users.registerUser(new RegisterUserDtoIn("HTTP tester", UUID.randomUUID() + "@example.com", "ValidPass1!"));
    }

    private MockHttpSession createLoggedInSession(UserDtoOut user) {
        MockHttpSession session = new MockHttpSession();
        session.setAttribute("userId", user.getId());
        session.setAttribute("credentialFingerprint", users.authenticateSessionLogin(new LoginDtoIn(user.getEmail(), "ValidPass1!")).getCredentialFingerprint());
        return session;
    }

    @Test
    void allRoutesAreMappedAndOnlyFiveArePublic() {
        var endpoints = mappings.getHandlerMethods().entrySet().stream().filter(e -> e.getValue().getBeanType().getPackageName().equals("com.example.dal.Controller")).toList();
        assertEquals(56, endpoints.size());
        long protectedCount = endpoints.stream().filter(e -> Arrays.stream(e.getValue().getMethod().getParameterTypes()).anyMatch(t -> t.equals(HttpSession.class))).count();
        assertEquals(51, protectedCount);
    }

    @Test
    void newEndpointsRequireSessionAndCsrf() throws Exception {
        mvc.perform(get("/api/v1/notification/unread-count")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/group-message/group/1")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/navigation/group/1/walking").contentType(MediaType.APPLICATION_JSON).content("{\"memberId\":2,\"meetingPoint\":false}")).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/navigation/group/1/reunion-assistance").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"memberId\":2,\"meetingPoint\":false}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/navigation/group/1/meeting-suggestions").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"candidates\":[]}")).andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/group-message/group/1").contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isForbidden());
    }

    @Test
    void groupConversationHttpWorkflowReachesThreeSessionsWithSenderNameAndRejectsOutsiders() throws Exception {
        UserDtoOut sender=registerTestUser(),second=registerTestUser(),third=registerTestUser(),outsider=registerTestUser();
        var group=groups.createGroup(sender.getId(),new com.example.dal.DtoIn.GroupDtoIn("HTTP group","DIRECT"));
        groups.joinGroup(second.getId(),new com.example.dal.DtoIn.JoinGroupDtoIn(group.getJoinCode()));groups.joinGroup(third.getId(),new com.example.dal.DtoIn.JoinGroupDtoIn(group.getJoinCode()));
        String path="/api/v1/group-message/group/"+group.getId();
        mvc.perform(post(path).with(csrf()).session(createLoggedInSession(sender)).contentType(MediaType.APPLICATION_JSON).content("{\"content\":\"Group HTTP hello\",\"clientMessageId\":\"http-group-test\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.senderName").value(sender.getName()));
        for(UserDtoOut user:java.util.List.of(sender,second,third)) mvc.perform(get(path).session(createLoggedInSession(user))).andExpect(status().isOk()).andExpect(jsonPath("$.content[0].content").value("Group HTTP hello")).andExpect(jsonPath("$.content[0].senderName").value(sender.getName()));
        mvc.perform(get(path).session(createLoggedInSession(outsider))).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/notification/unread-count").session(createLoggedInSession(second))).andExpect(status().isOk()).andExpect(jsonPath("$.count").value(1));
    }

    @Test
    void registrationReturnsSafeDtoAndDetailedPasswordError() throws Exception {
        mvc.perform(post("/api/v1/user/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"HTTP user\",\"email\":\"http-register@example.com\",\"password\":\"ValidPass1!\"}")).andExpect(status().isCreated()).andExpect(jsonPath("$.id").isNumber()).andExpect(jsonPath("$.password").doesNotExist());
        mvc.perform(post("/api/v1/user/register").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"HTTP user\",\"email\":\"http-invalid@example.com\",\"password\":\"ValidPass!\"}")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Password is missing a number"));
    }

    @Test
    void loginRotatesSessionAndLogoutInvalidatesIt() throws Exception {
        UserDtoOut user = registerTestUser();
        MockHttpSession existing = new MockHttpSession();
        String oldId = existing.getId();
        mvc.perform(post("/api/v1/user/login").with(csrf()).session(existing).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"ValidPass1!\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.password").doesNotExist());
        assertNotEquals(oldId, existing.getId());
        assertEquals(user.getId(), existing.getAttribute("userId"));
        mvc.perform(get("/api/v1/user/profile").session(existing)).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(user.getId()));
        mvc.perform(post("/api/v1/user/logout").with(csrf()).session(existing)).andExpect(status().isOk());
        assertTrue(existing.isInvalid());
        mvc.perform(get("/api/v1/user/profile")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Please log in first"));
    }

    @Test
    void failedLoginDoesNotAuthenticateSession() throws Exception {
        UserDtoOut user = registerTestUser();
        MockHttpSession session = new MockHttpSession();
        mvc.perform(post("/api/v1/user/login").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + user.getEmail() + "\",\"password\":\"WrongPass1!\"}")).andExpect(status().isBadRequest());
        assertNull(session.getAttribute("userId"));
    }

    @Test
    void groupRequestsUseSessionIdentityAndCheckMembership() throws Exception {
        UserDtoOut owner = registerTestUser();
        UserDtoOut outsider = registerTestUser();
        MockHttpSession ownerSession = createLoggedInSession(owner);
        mvc.perform(post("/api/v1/group/create").with(csrf()).session(ownerSession).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"HTTP group\",\"joinMode\":\"DIRECT\",\"userId\":" + outsider.getId() + "}")).andExpect(status().isCreated()).andExpect(jsonPath("$.createdById").value(owner.getId())).andExpect(jsonPath("$.myRole").value("OWNER"));
        mvc.perform(get("/api/v1/group/my").session(createLoggedInSession(outsider))).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(post("/api/v1/group/create").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Anonymous group\",\"joinMode\":\"DIRECT\"}")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Please log in first"));
    }

    @Test
    void validationAndUnreadableBodiesReachStandardAdvice() throws Exception {
        MockHttpSession session = createLoggedInSession(registerTestUser());
        mvc.perform(post("/api/v1/group/create").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Group\",\"joinMode\":\"INVALID\"}")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Join mode must be DIRECT or APPROVAL"));
        mvc.perform(post("/api/v1/group/create").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content("{")).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Invalid or missing JSON request body. Check the JSON syntax, field types, and date formats"));
        mvc.perform(get("/api/v1/group/not-a-number").session(session)).andExpect(status().isBadRequest()).andExpect(jsonPath("$.message").value("Invalid value for groupId"));
    }

    @Test
    void paginationAndPauseBodyAreValidatedOverHttp() throws Exception {
        MockHttpSession session = createLoggedInSession(registerTestUser());
        mvc.perform(get("/api/v1/notification/my").session(session).param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/sharing/pause").with(csrf()).session(session).contentType(MediaType.APPLICATION_JSON).content("{}")).andExpect(status().isOk()).andExpect(jsonPath("$.isPaused").value(true));
        mvc.perform(put("/api/v1/sharing/resume").with(csrf()).session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.isPaused").value(false));
    }

    @Test
    void passwordResetRoutesArePublicAndNeverReturnTokens() throws Exception {
        mvc.perform(post("/api/v1/password-reset/request").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"unknown-http@example.com\"}")).andExpect(status().isOk()).andExpect(jsonPath("$.token").doesNotExist());
        verifyNoInteractions(emailService);
        mvc.perform(post("/api/v1/password-reset/confirm").with(csrf()).contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"invalid\",\"newPassword\":\"ValidPass1!\"}")).andExpect(status().isBadRequest());
    }
}
