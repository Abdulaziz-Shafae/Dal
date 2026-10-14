package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.*;
import com.example.dal.DtoOut.*;
import com.example.dal.DtoIn.NavigationRequest.Destination;
import com.example.dal.DtoOut.NavigationResult.Route;
import com.example.dal.Model.*;
import com.example.dal.Repository.*;
import jakarta.validation.Validation;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LocationLifecycleTests {
    static class MutableClock extends Clock {
        Instant time = Instant.parse("2026-11-01T13:00:00Z");
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return time; }
    }
    MutableClock clock; User user; Group group; GroupMember member; LocationSharingSettings settings;
    UserLocation latest; UserLocationService locations; LocationSharingSettingsService sharing; GroupService groups;
    UserLocationRepository repository; GroupAccessService access;
    void time(String localTime) { clock.time = OffsetDateTime.parse("2026-11-01T" + localTime + "+03:00").toInstant(); }
    LocalDateTime now() { return LocalDateTime.now(clock); }
    UserLocationDtoOut read() { return locations.getGroupLocations(1,10).get(0); }
    void sample() {
        // A fresh measurement after an authorization change is a later event.
        for (var boundary : Arrays.asList(settings.getLocationsValidFrom(),member.getLocationsValidFrom())) {
            if (boundary != null && !now().isAfter(boundary)) clock.time=boundary.toInstant(ZoneOffset.UTC).plusMillis(1);
        }
        locations.updateUserLocation(1,new LocationDtoIn(24.0,46.0,5.0,clock.instant().atOffset(ZoneOffset.UTC)));
    }
    void mode(String mode) { sharing.updateSharingSettings(1,new SharingSettingsDtoIn(mode, "SCHEDULED".equals(mode) ? OffsetDateTime.parse("2026-11-01T16:00:00+03:00") : null, "SCHEDULED".equals(mode) ? OffsetDateTime.parse("2026-11-01T22:00:00+03:00") : null,15)); }
    @BeforeEach void setup() {
        clock = new MutableClock(); user = new User(); user.setId(1); user.setName("Synthetic member"); user.setCreatedAt(now().minusDays(1));
        group = new Group(); group.setId(10); group.setStatus("ACTIVE"); group.setCreatedBy(user);
        member = new GroupMember(); member.setUser(user); member.setGroup(group); member.setJoinedAt(now().minusDays(1)); member.setRole("OWNER");
        settings = new LocationSharingSettings(); settings.setUser(user); settings.setSharingMode("WHILE_USING");
        var validation = new InputValidationService(Validation.buildDefaultValidatorFactory().getValidator(),clock);
        access = mock(GroupAccessService.class); when(access.requireUser(1)).thenReturn(user); when(access.requireUserForUpdate(1)).thenReturn(user);
        when(access.requireMember(1,10)).thenReturn(member); when(access.requireManager(1,10)).thenReturn(member); when(access.requireGroupForUpdate(10)).thenReturn(group);
        var settingsRepository = mock(LocationSharingSettingsRepository.class); when(settingsRepository.findByUser_Id(1)).thenReturn(settings);
        var members = mock(GroupMemberRepository.class); when(members.findAllByGroup_Id(10)).thenReturn(List.of(member));
        sharing = new LocationSharingSettingsService(settingsRepository,members,access,validation);
        repository = mock(UserLocationRepository.class); when(repository.findFirstByUser_IdOrderByRecordedAtDescIdDesc(1)).thenAnswer(call -> latest);
        when(repository.save(any(UserLocation.class))).thenAnswer(call -> { latest=call.getArgument(0);return latest; });
        locations = new UserLocationService(repository,members,settingsRepository,sharing,access,validation);
        groups = new GroupService(mock(GroupRepository.class),members,mock(GroupJoinRequestRepository.class),access,validation);
    }
    @Test void scheduledLastKnownSurvivesDisconnectUntilExactAbsoluteEndWithOffsets() {
        mode("SCHEDULED"); sample(); assertNotNull(read().getLatitude()); var recorded=read().getRecordedAt();
        assertEquals(OffsetDateTime.parse("2026-11-01T19:00:00Z"),read().getVisibleUntil());
        for (String hour : List.of("18:00:00","21:59:59")) { time(hour); assertNotNull(read().getLatitude()); assertEquals(recorded,read().getRecordedAt()); }
        time("22:00:00"); assertNull(read().getLatitude()); assertNull(read().getRecordedAt()); assertFalse(read().getSharingEnabled());
    }
    @Test void scheduledReconnectBeforeExpirationCanPublishAgainButNewPeriodDoesNotReuseOldRow() {
        mode("SCHEDULED"); sample(); time("18:00:00"); sample(); assertNotNull(read().getLatitude());
        sharing.updateSharingSettings(1,new SharingSettingsDtoIn("SCHEDULED",OffsetDateTime.parse("2026-11-02T16:00:00+03:00"),OffsetDateTime.parse("2026-11-02T22:00:00+03:00"),15));
        clock.time = Instant.parse("2026-11-02T13:00:00Z"); assertNull(read().getLatitude()); sample(); assertNotNull(read().getLatitude());
    }
    @Test void scheduledSharingIsNotAuthorizedBeforeStartOrAtEnd() {
        time("15:59:59"); mode("SCHEDULED"); assertThrows(ApiException.class,this::sample);
        time("16:00:00"); sample(); assertNotNull(read().getLatitude()); time("22:00:00"); assertThrows(ApiException.class,this::sample);
    }
    @Test void whileUsingHasServerLeaseAndStationaryRenewalKeepsMeasurementTimestamp() {
        sample(); var measurement=latest.getRecordedAt(); assertEquals(now().plusSeconds(90).atOffset(ZoneOffset.UTC),read().getVisibleUntil());
        time("16:00:30"); locations.updateUserLocation(1,new LocationDtoIn(24.0,46.0,5.0,measurement.atOffset(ZoneOffset.UTC)));
        assertEquals(measurement,latest.getRecordedAt()); assertEquals(now(),latest.getActivityAt());
        time("16:01:59"); assertNotNull(read().getLatitude()); time("16:02:00"); assertNull(read().getLatitude());
        // A fresh authorized measurement resumes without any browser-close callback.
        sample(); assertNotNull(read().getLatitude());
    }
    @Test void oldOrForgedMeasurementCannotExtendLease() {
        sample(); var activity=latest.getActivityAt(); time("16:00:30");
        locations.updateUserLocation(1,new LocationDtoIn(25.0,47.0,5.0,activity.minusSeconds(1).atOffset(ZoneOffset.UTC)));
        assertEquals(activity,latest.getActivityAt());
        locations.updateUserLocation(1,new LocationDtoIn(25.0,47.0,5.0,latest.getRecordedAt().atOffset(ZoneOffset.UTC)));
        assertEquals(activity,latest.getActivityAt());
        assertThrows(ApiException.class,()->locations.updateUserLocation(1,new LocationDtoIn(24.0,46.0,5.0,clock.instant().plusSeconds(31).atOffset(ZoneOffset.UTC))));
        time("16:01:30"); assertNull(read().getLatitude());
    }
    @Test void alwaysPersistsLastKnownButGlobalPauseResumeRequiresNewMeasurement() {
        mode("ALWAYS"); sample(); time("21:59:00"); assertNotNull(read().getLatitude()); assertNull(read().getVisibleUntil());
        var old=latest.getRecordedAt(); sharing.pauseAllLocationSharing(1,new PauseDtoIn()); assertNull(read().getLatitude());
        time("22:00:00"); sharing.resumeAllLocationSharing(1); assertNull(read().getLatitude());
        locations.updateUserLocation(1,new LocationDtoIn(24.0,46.0,5.0,old.atOffset(ZoneOffset.UTC))); assertNull(read().getLatitude());
        sample(); assertNotNull(read().getLatitude());
    }
    @Test void timedPauseAutomaticExpiryCannotResurrectPreviousPeriod() {
        mode("ALWAYS"); sample(); time("17:00:00"); sharing.pauseAllLocationSharing(1,new PauseDtoIn(OffsetDateTime.parse("2026-11-01T18:00:00+03:00")));
        time("18:00:00"); assertNull(read().getLatitude()); sample(); assertNotNull(read().getLatitude());
    }
    @Test void membershipPauseResumeAndGroupPauseResumeInvalidateOnlyAuthorizedPeriods() {
        mode("ALWAYS"); sample(); time("17:00:00"); sharing.pauseSharingForGroup(1,10,new PauseDtoIn()); assertNull(read().getLatitude());
        time("17:01:00"); sharing.resumeSharingForGroup(1,10); assertNull(read().getLatitude()); sample(); assertNotNull(read().getLatitude());
        time("18:00:00"); groups.pauseGroup(1,10,new PauseDtoIn(OffsetDateTime.parse("2026-11-01T19:00:00+03:00"))); assertNull(read().getLatitude());
        time("19:00:00"); assertNull(read().getLatitude()); groups.resumeGroup(1,10); assertNull(read().getLatitude()); sample(); assertNotNull(read().getLatitude());
        group.setStatus("CLOSED"); assertNull(read().getLatitude());
    }
    @Test void legacyRowsMissingServerActivityFailClosedAndOutsidersCannotRead() {
        mode("ALWAYS"); sample(); latest.setActivityAt(null); assertNull(read().getLatitude());
        when(access.requireMember(99,10)).thenThrow(new ApiException("You are not a member of this group")); assertThrows(ApiException.class,()->locations.getGroupLocations(99,10));
    }
    @Test void pauseResumeInTheSameClockTickCannotExposeOrHeartbeatAnEarlierPeriod() {
        mode("ALWAYS"); sample(); var recorded=latest.getRecordedAt();
        sharing.pauseAllLocationSharing(1,new PauseDtoIn()); sharing.resumeAllLocationSharing(1);
        assertNull(read().getLatitude()); locations.updateUserLocation(1,new LocationDtoIn(24.0,46.0,5.0,recorded.atOffset(ZoneOffset.UTC))); assertNull(read().getLatitude());
        sample(); assertNotNull(read().getLatitude());
        sharing.pauseSharingForGroup(1,10,new PauseDtoIn()); sharing.resumeSharingForGroup(1,10); assertNull(read().getLatitude());
        sample(); assertNotNull(read().getLatitude());
    }
    @Test void publicMetadataIncludesExplicitUnboundedDeadlineWithoutPrivateSharingSettings() throws Exception {
        mode("ALWAYS"); sample();
        var mapper=tools.jackson.databind.json.JsonMapper.builder().findAndAddModules()
                .changeDefaultPropertyInclusion(value -> value.withValueInclusion(com.fasterxml.jackson.annotation.JsonInclude.Include.NON_NULL)).build();
        var json=mapper.readTree(mapper.writeValueAsString(read()));
        assertTrue(json.has("visibleUntil")); assertTrue(json.get("visibleUntil").isNull());
        for(String field:List.of("sharingMode","visibilityMode","startTime","activityAt","locationsValidFrom")) assertFalse(json.has(field));
        mode("WHILE_USING"); sample();
        var finite=mapper.readTree(mapper.writeValueAsString(read()));
        assertTrue(finite.get("visibleUntil").isTextual());
        assertEquals(read().getVisibleUntil(),OffsetDateTime.parse(finite.get("visibleUntil").asText()));
    }
    @Test void sampleBeyondScheduledEndCannotReplaceTheLastAuthorizedFix() {
        mode("SCHEDULED"); sample(); var old=latest;
        time("21:59:50"); locations.updateUserLocation(1,new LocationDtoIn(25.0,47.0,5.0,clock.instant().plusSeconds(20).atOffset(ZoneOffset.UTC)));
        assertSame(old,latest); assertNotNull(read().getLatitude()); time("22:00:00"); assertNull(read().getLatitude());
    }
    @Test void delayedProcessingDoesNotTurnAnOldRequestIntoNewActivity() {
        sample(); var measurement=latest.getRecordedAt(); time("16:00:30");
        doAnswer(call->{clock.time=clock.time.plusSeconds(100);return user;}).when(access).requireUserForUpdate(1);
        locations.updateUserLocation(1,new LocationDtoIn(24.0,46.0,5.0,measurement.atOffset(ZoneOffset.UTC)));
        assertEquals(LocalDateTime.parse("2026-11-01T13:00:30"),latest.getActivityAt());
        assertNull(read().getLatitude());
    }
    @Test void staleMemberRoutesAreRejectedBeforeProviderAndIfTheyAgeDuringRequest() {
        var stored=mock(UserLocationService.class); var routing=mock(WalkingRoutingService.class);
        var service = new NavigationAssistanceService(access,stored,mock(MeetingPointService.class),routing,mock(AiExplanationService.class),mock(MeetingPointRepository.class),clock);
        var own = new UserLocationDtoOut(1,"Own",24.0,46.0,5.0,clock.instant().atOffset(ZoneOffset.UTC),true);
        var target = new UserLocationDtoOut(2,"Target",24.001,46.001,5.0,clock.instant().minusMillis(30001).atOffset(ZoneOffset.UTC),true);
        when(stored.getGroupLocations(1,10)).thenReturn(List.of(own,target)); assertEquals("LOCATION_UNAVAILABLE",service.walking(1,10,new Destination(2,false)).status()); verifyNoInteractions(routing);
        target.setRecordedAt(clock.instant().atOffset(ZoneOffset.UTC));
        when(routing.route(anyDouble(),anyDouble(),anyDouble(),anyDouble())).thenAnswer(call->{clock.time=clock.time.plusSeconds(31);return new Route("READY",List.of(List.of(24.0,46.0),List.of(24.001,46.001)),100.0,80.0,"",false);});
        assertEquals("LOCATION_UNAVAILABLE",service.walking(1,10,new Destination(2,false)).status());
    }
    @Test void fixedMeetingRouteDoesNotRequireMemberLocationTimestamp() {
        var stored=mock(UserLocationService.class); var routing=mock(WalkingRoutingService.class); var meetings=mock(MeetingPointService.class);
        var service=new NavigationAssistanceService(access,stored,meetings,routing,mock(AiExplanationService.class),mock(MeetingPointRepository.class),clock);
        var own=new UserLocationDtoOut(1,"Own",24.0,46.0,5.0,clock.instant().atOffset(ZoneOffset.UTC),true); when(stored.getGroupLocations(1,10)).thenReturn(List.of(own));
        var meeting=new MeetingPointDtoOut(); meeting.setLatitude(24.001); meeting.setLongitude(46.001); when(meetings.getGroupMeetingPoint(1,10)).thenReturn(meeting);
        when(routing.route(anyDouble(),anyDouble(),anyDouble(),anyDouble())).thenReturn(new Route("READY",List.of(),100.0,80.0,"",false));
        assertEquals("READY",service.walking(1,10,new Destination(null,true)).status());
    }
}
