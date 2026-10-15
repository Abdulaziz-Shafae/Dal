package com.example.dal;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.*;
import com.example.dal.DtoIn.NavigationRequest.*;
import com.example.dal.DtoOut.*;
import com.example.dal.Service.*;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@IsolatedDalContext @Transactional
class FinalFeaturesWorkflowTests {
    @MockitoBean Clock clock;
    private Instant testTime;
    @BeforeEach void clockStartsAtCurrentTime() {
        testTime=Instant.now();
        when(clock.getZone()).thenReturn(ZoneOffset.UTC);
        when(clock.instant()).thenAnswer(call -> testTime);
    }
    @Autowired UserService users;
    @Autowired GroupService groups;
    @Autowired GroupMessageService chats;
    @Autowired MessageService privateMessages;
    @Autowired NotificationService notifications;
    @Autowired UserLocationService locations;
    @Autowired LocationSharingSettingsService sharing;
    @Autowired MeetingPointService meeting;
    @Autowired NavigationAssistanceService navigation;
    @Autowired com.example.dal.Repository.UserLocationRepository locationRepository;
    @Autowired com.example.dal.Repository.UserRepository userRepository;
    private UserDtoOut user(String name) {return users.registerUser(new RegisterUserDtoIn(name,UUID.randomUUID()+"@example.invalid","ValidPass1!"));}
    private GroupDtoOut group(UserDtoOut owner,UserDtoOut... members) {GroupDtoOut g=groups.createGroup(owner.getId(),new GroupDtoIn("Test group","DIRECT"));for(UserDtoOut m:members)groups.joinGroup(m.getId(),new JoinGroupDtoIn(g.getJoinCode()));return g;}
    private void location(UserDtoOut u,double lat) {
        // Give creation, authorization and measurement distinct clock ticks.
        if (Instant.now().isAfter(testTime)) testTime=Instant.now();
        testTime=testTime.plusMillis(1);
        locations.updateUserLocation(u.getId(),new LocationDtoIn(lat,46.6753,8.0,clock.instant().atOffset(ZoneOffset.UTC)));
    }
    @Test void groupMessagesReachThreeMembersDeduplicateAndIsolatePrivateRead() {
        var a=user("A");var b=user("B");var c=user("C");var outsider=user("Outsider");var g=group(a,b,c);
        var input=new SendMessageDtoIn("Group hello",UUID.randomUUID().toString());
        var sent=chats.send(a.getId(),g.getId(),input);
        assertEquals(sent.id(),chats.send(a.getId(),g.getId(),input).id());
        for(var member:List.of(a,b,c)) {var message=chats.conversation(member.getId(),g.getId(),0,20).getContent().get(0);assertEquals("A",message.senderName());assertEquals("Group hello",message.content());}
        assertEquals(1,notifications.unreadCount(b.getId()));assertEquals(1,notifications.unreadCount(c.getId()));
        var privateMessage=privateMessages.sendMessage(a.getId(),g.getId(),b.getId(),new SendMessageDtoIn("Private",UUID.randomUUID().toString()));
        chats.read(b.getId(),g.getId(),sent.id());assertEquals(0,chats.unread(b.getId(),g.getId()));assertEquals(1,chats.unread(c.getId(),g.getId()));
        assertNull(privateMessages.getConversation(b.getId(),g.getId(),a.getId(),0,20).getContent().get(0).getReadAt());
        assertEquals(2,notifications.unreadCount(b.getId()));
        assertThrows(ApiException.class,()->chats.conversation(outsider.getId(),g.getId(),0,20));
        assertThrows(ApiException.class,()->chats.send(outsider.getId(),g.getId(),input));
        assertThrows(ApiException.class,()->chats.read(outsider.getId(),g.getId(),sent.id()));
        assertThrows(ApiException.class,()->chats.send(a.getId(),g.getId(),new SendMessageDtoIn("Changed",input.getClientMessageId())));
        assertThrows(ApiException.class,()->chats.conversation(a.getId(),g.getId(),-1,20));
    }
    @Test void notificationCountUsesAllRowsAndOnlyExplicitReadDecrements() {
        var a=user("A");var b=user("B");var g=group(a,b);
        assertEquals(0,notifications.unreadCount(b.getId()));
        for(int i=0;i<105;i++) chats.send(a.getId(),g.getId(),new SendMessageDtoIn("Message "+i,UUID.randomUUID().toString()));
        assertEquals(105,notifications.unreadCount(b.getId()));
        var first=notifications.getMyNotifications(b.getId(),0,20).getContent().get(0);
        assertEquals(105,notifications.unreadCount(b.getId()));
        notifications.markNotificationRead(b.getId(),first.getId());assertEquals(104,notifications.unreadCount(b.getId()));
        notifications.markNotificationRead(b.getId(),first.getId());assertEquals(104,notifications.unreadCount(b.getId()));
    }
    @Test void navigationRespectsMembershipAndRevocationAndMissingConfiguration() {
        var a=user("A");var b=user("B");var outsider=user("Outside");var g=group(a,b);location(a,24.7136);location(b,24.7142);
        var target=new Destination(b.getId(),false);
        for (var row : locations.getGroupLocations(a.getId(),g.getId())) assertTrue(row.getSharingEnabled(), "Fresh fixture must belong to its authorized group period");
        assertThrows(ApiException.class,()->navigation.walking(outsider.getId(),g.getId(),target));
        var route=navigation.walking(a.getId(),g.getId(),target);assertEquals("UNAVAILABLE",route.status());assertNull(route.distanceMeters());assertNull(route.durationSeconds());assertTrue(route.coordinates().isEmpty());
        var advice=navigation.reunion(a.getId(),g.getId(),target);assertEquals("RULES",advice.source());assertEquals("RECENT",advice.locationStatus());assertTrue(advice.directDistanceMeters()>0);
        sharing.pauseSharingForGroup(b.getId(),g.getId(),new PauseDtoIn());
        assertEquals("UNAVAILABLE",navigation.reunion(a.getId(),g.getId(),target).locationStatus());
        assertEquals("LOCATION_UNAVAILABLE",navigation.walking(a.getId(),g.getId(),target).status());
        assertThrows(ApiException.class,()->navigation.walking(a.getId(),g.getId(),new Destination(b.getId(),true)));
        assertThrows(ApiException.class,()->navigation.walking(a.getId(),g.getId(),new Destination(outsider.getId(),false)));
    }
    @Test void oldLocationsWarnAndMeetingSuggestionsOnlyRankExplicitCandidates() {
        var a=user("A");var b=user("B");var g=group(a,b);
        sharing.updateSharingSettings(b.getId(),new SharingSettingsDtoIn("ALWAYS",null,null,15));
        location(a,24.7136);location(b,24.7156);
        var candidates=new Candidates(List.of(new Candidate("Near",24.7146,46.6753),new Candidate("Far",24.8,46.6753)));
        var result=navigation.suggest(a.getId(),g.getId(),candidates);assertEquals("RULES",result.source());assertEquals("Near",result.ranking().get(0).name());
        assertThrows(ApiException.class,()->meeting.getGroupMeetingPoint(a.getId(),g.getId()));
        assertThrows(ApiException.class,()->navigation.suggest(b.getId(),g.getId(),candidates));
        // Age an authorized measurement without backdating it before account/group creation.
        testTime=testTime.plusSeconds(240);
        location(a,24.7136);
        var old=navigation.reunion(a.getId(),g.getId(),new Destination(b.getId(),false));assertEquals("STALE",old.locationStatus());assertTrue(old.ageSeconds()>=240);assertEquals("CONTACT_MEMBER",old.action());
        assertTrue(navigation.suggest(a.getId(),g.getId(),candidates).ranking().isEmpty());
        meeting.setMeetingPoint(a.getId(),g.getId(),new MeetingPointDtoIn("Confirmed",24.7146,46.6753));
        assertEquals("UNAVAILABLE",navigation.walking(a.getId(),g.getId(),new Destination(null,true)).status());
        assertEquals("RECENT",navigation.reunion(a.getId(),g.getId(),new Destination(null,true)).locationStatus());
    }
    @Test void latestLocationSurvivesReloadWithoutInventingCoordinatesAndHonorsDeletion() {
        var a=user("A");assertNull(locations.getMyLatestLocation(a.getId()).getLatitude());location(a,24.7136);
        assertEquals(24.7136,locations.getMyLatestLocation(a.getId()).getLatitude());
        locations.deleteMyLocationHistory(a.getId());assertNull(locations.getMyLatestLocation(a.getId()).getLatitude());
    }
}
