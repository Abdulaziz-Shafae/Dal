package com.example.dal;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.*;
import com.example.dal.DtoOut.*;
import com.example.dal.Model.PasswordResetToken;
import com.example.dal.Repository.*;
import com.example.dal.Service.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.mockito.ArgumentCaptor;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@IsolatedDalContext
@Transactional
class ServiceWorkflowTests {

    @Autowired UserService users;
    @Autowired PasswordPolicyService passwords;
    @Autowired PasswordResetService resets;
    @Autowired GroupService groups;
    @Autowired GroupMemberService members;
    @Autowired GroupJoinRequestService requests;
    @Autowired LocationSharingSettingsService sharing;
    @Autowired UserLocationService locations;
    @Autowired MeetingPointService meetingPoints;
    @Autowired MessageService messages;
    @Autowired NotificationService notifications;
    @Autowired ReunionService reunions;
    @Autowired UserRepository userRepository;
    @Autowired GroupRepository groupRepository;
    @Autowired PasswordResetTokenRepository tokenRepository;
    @Autowired GroupMemberRepository memberRepository;
    @Autowired PasswordEncoder encoder;
    @Autowired EntityManager entityManager;
    @MockitoBean BrevoEmailService emailService;

    private UserDtoOut registerUser() {
        return users.registerUser(new RegisterUserDtoIn("Tester", UUID.randomUUID() + "@example.com", "ValidPass1!"));
    }

    private GroupDtoOut createGroup(UserDtoOut owner, String mode) {
        return groups.createGroup(owner.getId(), new GroupDtoIn("Dal test", mode));
    }

    private void joinGroup(UserDtoOut user, GroupDtoOut group) {
        groups.joinGroup(user.getId(), new JoinGroupDtoIn(group.getJoinCode().toLowerCase()));
    }

    private void updateLocation(UserDtoOut user) {
        locations.updateUserLocation(user.getId(), new LocationDtoIn(24.7136, 46.6753, 5.0, OffsetDateTime.now(ZoneOffset.UTC)));
    }

    @Test
    void registrationHashesPasswordAndCreatesDefaultSettings() {
        UserDtoOut user = registerUser();
        String hash = userRepository.findUserById(user.getId()).getPassword();
        assertNotEquals("ValidPass1!", hash);
        assertTrue(encoder.matches("ValidPass1!", hash));
        assertEquals("WHILE_USING", sharing.getSharingSettings(user.getId()).getSharingMode());
        assertEquals(user.getId(), users.loginUser(new LoginDtoIn(user.getEmail().toUpperCase(), "ValidPass1!")));
    }

    @Test
    void passwordMessagesIdentifyEachMissingCondition() {
        String message = assertThrows(ApiException.class, () -> passwords.validatePassword("abcdefgh")).getMessage();
        assertTrue(message.contains("uppercase"));
        assertTrue(message.contains("number"));
        assertTrue(message.contains("symbol"));
        assertFalse(message.contains("lowercase"));
        assertTrue(assertThrows(ApiException.class, () -> passwords.validatePassword("Ab1!")).getMessage().contains("8 characters"));
        assertDoesNotThrow(() -> passwords.validatePassword("StrongPass1!"));
    }

    @Test
    void duplicateEmailsAreCaseInsensitive() {
        UserDtoOut user = registerUser();
        assertThrows(ApiException.class, () -> users.registerUser(new RegisterUserDtoIn("Other", user.getEmail().toUpperCase(), "ValidPass1!")));
    }

    @Test
    void joinCodeIsFiveAlphanumericCharactersAndAcceptsLowercase() {
        UserDtoOut owner = registerUser();
        UserDtoOut learner = registerUser();
        GroupDtoOut group = createGroup(owner, "DIRECT");
        assertTrue(group.getJoinCode().matches("[A-Z0-9]{5}"));
        joinGroup(learner, group);
        assertEquals(2, members.getGroupMembers(owner.getId(), group.getId()).size());
        assertThrows(ApiException.class, () -> joinGroup(learner, group));
    }

    @Test
    void approvalCreatesMembershipOnlyAfterReview() {
        UserDtoOut owner = registerUser();
        UserDtoOut learner = registerUser();
        GroupDtoOut group = createGroup(owner, "APPROVAL");
        JoinGroupDtoOut result = groups.joinGroup(learner.getId(), new JoinGroupDtoIn(group.getJoinCode()));
        assertEquals("PENDING", result.getStatus());
        assertFalse(memberRepository.existsByUser_IdAndGroup_Id(learner.getId(), group.getId()));
        requests.approveJoinRequest(owner.getId(), result.getRequestId());
        assertTrue(memberRepository.existsByUser_IdAndGroup_Id(learner.getId(), group.getId()));
        assertThrows(ApiException.class, () -> requests.approveJoinRequest(owner.getId(), result.getRequestId()));
    }

    @Test
    void outsidersCannotReadLocationsOrManageMembers() {
        UserDtoOut owner = registerUser();
        UserDtoOut outsider = registerUser();
        GroupDtoOut group = createGroup(owner, "DIRECT");
        assertThrows(ApiException.class, () -> locations.getGroupLocations(outsider.getId(), group.getId()));
        assertThrows(ApiException.class, () -> groups.pauseGroup(outsider.getId(), group.getId(), new PauseDtoIn()));
    }

    @Test
    void globalPauseHidesOldCoordinatesEverywhere() {
        UserDtoOut owner = registerUser();
        GroupDtoOut group = createGroup(owner, "DIRECT");
        updateLocation(owner);
        sharing.pauseAllLocationSharing(owner.getId(), new PauseDtoIn());
        UserLocationDtoOut hidden = locations.getGroupLocations(owner.getId(), group.getId()).get(0);
        assertFalse(hidden.getSharingEnabled());
        assertNull(hidden.getLatitude());
        assertNull(hidden.getLongitude());
        assertNull(hidden.getRecordedAt());
        assertNull(locations.getMyLatestLocation(owner.getId()).getLatitude());
    }

    @Test
    void membershipPauseAffectsOnlySelectedGroupAndSurvivesGlobalResume() {
        UserDtoOut owner = registerUser();
        GroupDtoOut first = createGroup(owner, "DIRECT");
        GroupDtoOut second = createGroup(owner, "DIRECT");
        updateLocation(owner);
        sharing.pauseSharingForGroup(owner.getId(), first.getId(), new PauseDtoIn());
        assertNull(locations.getGroupLocations(owner.getId(), first.getId()).get(0).getLatitude());
        assertNotNull(locations.getGroupLocations(owner.getId(), second.getId()).get(0).getLatitude());
        sharing.pauseAllLocationSharing(owner.getId(), new PauseDtoIn());
        sharing.resumeAllLocationSharing(owner.getId());
        assertFalse(sharing.getSharingForGroup(owner.getId(), first.getId()).getSharingEnabled());
    }

    @Test
    void groupPauseStopsLocationsButStillAllowsJoining() {
        UserDtoOut owner = registerUser();
        UserDtoOut learner = registerUser();
        GroupDtoOut group = createGroup(owner, "DIRECT");
        updateLocation(owner);
        groups.pauseGroup(owner.getId(), group.getId(), new PauseDtoIn());
        joinGroup(learner, group);
        assertEquals(2, members.getGroupMembers(owner.getId(), group.getId()).size());
        assertNull(locations.getGroupLocations(learner.getId(), group.getId()).get(0).getLatitude());
    }

    @Test
    void olderLocationsCannotReplaceLatestAndDatesAreUtc() {
        UserDtoOut owner = registerUser();
        OffsetDateTime first = OffsetDateTime.now(ZoneOffset.ofHours(3));
        UserLocationDtoOut result = locations.updateUserLocation(owner.getId(), new LocationDtoIn(24.0, 46.0, 5.0, first));
        UserLocationDtoOut second = locations.updateUserLocation(owner.getId(), new LocationDtoIn(25.0, 47.0, 5.0, first));
        assertEquals(24.0, second.getLatitude());
        assertEquals(ZoneOffset.UTC, result.getRecordedAt().getOffset());
        assertThrows(ApiException.class, () -> locations.updateUserLocation(owner.getId(), new LocationDtoIn(24.0, 46.0, 5.0, first.plusDays(1))));
    }

    @Test
    void ownershipTransferKeepsOneOwnerAndOriginalCreator() {
        UserDtoOut owner = registerUser();
        UserDtoOut learner = registerUser();
        GroupDtoOut group = createGroup(owner, "DIRECT");
        joinGroup(learner, group);
        Integer memberId = memberRepository.findByUser_IdAndGroup_Id(learner.getId(), group.getId()).getId();
        groups.transferGroupOwnership(owner.getId(), group.getId(), memberId);
        List<GroupMemberDtoOut> list = members.getGroupMembers(learner.getId(), group.getId());
        assertEquals(1, list.stream().filter(m -> "OWNER".equals(m.getRole())).count());
        assertEquals(owner.getId(), groupRepository.findGroupById(group.getId()).getCreatedBy().getId());
        assertThrows(ApiException.class, () -> members.leaveGroup(learner.getId(), group.getId()));
    }

    @Test
    void meetingPointSetUpdatesOneRowOnly() {
        UserDtoOut owner = registerUser();
        GroupDtoOut group = createGroup(owner, "DIRECT");
        MeetingPointDtoOut first = meetingPoints.setMeetingPoint(owner.getId(), group.getId(), new MeetingPointDtoIn("Gate", 24.0, 46.0));
        MeetingPointDtoOut second = meetingPoints.setMeetingPoint(owner.getId(), group.getId(), new MeetingPointDtoIn("Pavilion", 24.1, 46.1));
        assertEquals(first.getId(), second.getId());
        assertEquals("Pavilion", meetingPoints.getGroupMeetingPoint(owner.getId(), group.getId()).getName());
    }

    @Test
    void messageRetryReturnsSameMessageAndThirdPartyCannotRead() {
        UserDtoOut owner = registerUser();
        UserDtoOut receiver = registerUser();
        UserDtoOut third = registerUser();
        GroupDtoOut group = createGroup(owner, "DIRECT");
        joinGroup(receiver, group);
        joinGroup(third, group);
        SendMessageDtoIn input = new SendMessageDtoIn("I am coming", "message-1");
        MessageDtoOut first = messages.sendMessage(owner.getId(), group.getId(), receiver.getId(), input);
        MessageDtoOut retry = messages.sendMessage(owner.getId(), group.getId(), receiver.getId(), input);
        assertEquals(first.getId(), retry.getId());
        assertEquals(1, notifications.getMyNotifications(receiver.getId(), 0, 20).getTotalElements());
        assertEquals(0, messages.getConversation(third.getId(), group.getId(), owner.getId(), 0, 20).getTotalElements());
        assertThrows(ApiException.class, () -> messages.markMessageRead(third.getId(), first.getId()));
        assertNotNull(messages.markMessageRead(receiver.getId(), first.getId()).getReadAt());
    }

    @Test
    void nudgeAndArrivalAreThrottled() {
        UserDtoOut owner = registerUser();
        UserDtoOut receiver = registerUser();
        GroupDtoOut group = createGroup(owner, "DIRECT");
        joinGroup(receiver, group);
        notifications.nudgeGroupMember(owner.getId(), group.getId(), receiver.getId(), new NudgeDtoIn("ON_MY_WAY"));
        assertThrows(ApiException.class, () -> notifications.nudgeGroupMember(owner.getId(), group.getId(), receiver.getId(), new NudgeDtoIn("WHERE_ARE_YOU")));
        assertEquals(reunions.recordArrival(owner.getId(), group.getId(), receiver.getId()).getId(), reunions.recordArrival(owner.getId(), group.getId(), receiver.getId()).getId());
    }

    @Test
    void resetTokenHas24HourExpiryIsHashedAndCannotBeReused() {
        UserDtoOut user = registerUser();
        resets.requestPasswordReset(new PasswordResetRequestDtoIn(user.getEmail()));
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendPasswordResetEmail(eq(user.getEmail()), link.capture());
        String raw = link.getValue().split("token=")[1];
        PasswordResetToken stored = tokenRepository.findAllByUser_IdAndUsedAtIsNull(user.getId()).get(0);
        assertNotEquals(raw, stored.getTokenHash());
        assertEquals(64, stored.getTokenHash().length());
        assertTrue(stored.getExpiresAt().isAfter(stored.getCreatedAt().plusHours(23)));
        assertTrue(stored.getExpiresAt().isBefore(stored.getCreatedAt().plusHours(25)));
        resets.confirmPasswordReset(new PasswordResetConfirmDtoIn(raw, "NewValidPass2!"));
        entityManager.flush();
        assertTrue(encoder.matches("NewValidPass2!", userRepository.findUserById(user.getId()).getPassword()));
        assertThrows(ApiException.class, () -> resets.confirmPasswordReset(new PasswordResetConfirmDtoIn(raw, "NextValidPass3!")));
    }

    @Test
    void unknownResetEmailDoesNotSendEmail() {
        resets.requestPasswordReset(new PasswordResetRequestDtoIn("unknown-" + UUID.randomUUID() + "@example.com"));
        verifyNoInteractions(emailService);
    }

    @Test
    void expiredResetTokenIsRejected() {
        UserDtoOut user = registerUser();
        resets.requestPasswordReset(new PasswordResetRequestDtoIn(user.getEmail()));
        ArgumentCaptor<String> link = ArgumentCaptor.forClass(String.class);
        verify(emailService).sendPasswordResetEmail(eq(user.getEmail()), link.capture());
        String raw = link.getValue().split("token=")[1];
        PasswordResetToken token = tokenRepository.findAllByUser_IdAndUsedAtIsNull(user.getId()).get(0);
        token.setExpiresAt(token.getCreatedAt().minusSeconds(1));
        entityManager.flush();
        assertThrows(ApiException.class, () -> resets.confirmPasswordReset(new PasswordResetConfirmDtoIn(raw, "NewValidPass2!")));
    }
}
