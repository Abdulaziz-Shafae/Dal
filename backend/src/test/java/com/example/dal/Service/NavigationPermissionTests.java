package com.example.dal.Service;

import com.example.dal.DtoIn.NavigationRequest.Destination;
import com.example.dal.DtoOut.UserLocationDtoOut;
import com.example.dal.DtoOut.NavigationResult.Route;
import com.example.dal.Repository.MeetingPointRepository;
import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class NavigationPermissionTests {
    @Test void meetingExplanationIncludesDerivedCurrentMeetingContextButRanksOnlyExplicitCandidates() {
        var access=mock(GroupAccessService.class);var locations=mock(UserLocationService.class);var meetings=mock(MeetingPointService.class);var routing=mock(WalkingRoutingService.class);var ai=mock(AiExplanationService.class);var repository=mock(MeetingPointRepository.class);
        var service=new NavigationAssistanceService(access,locations,meetings,routing,ai,repository,Clock.systemUTC());
        var own=new UserLocationDtoOut(1,"Private name",24.0,46.0,8.0,OffsetDateTime.now(ZoneOffset.UTC),true);
        var target=new UserLocationDtoOut(2,"Private target",24.001,46.001,8.0,OffsetDateTime.now(ZoneOffset.UTC),true);
        when(locations.getGroupLocations(1,10)).thenReturn(List.of(own,target));
        var current=new com.example.dal.Model.MeetingPoint();current.setLatitude(24.002);current.setLongitude(46.002);when(repository.findByGroup_Id(10)).thenReturn(current);
        when(ai.explain(anyMap())).thenAnswer(call->{Map<?,?> facts=call.getArgument(0);assertEquals(true,facts.get("currentMeetingPointAvailable"));assertTrue((Double)facts.get("currentMeetingMaximumDirectDistanceMeters")>0);assertFalse(facts.containsKey("latitude"));return Optional.empty();});
        var input=new com.example.dal.DtoIn.NavigationRequest.Candidates(List.of(new com.example.dal.DtoIn.NavigationRequest.Candidate("Chosen candidate",24.0005,46.0005)));
        var result=service.suggest(1,10,input);assertEquals(1,result.ranking().size());assertEquals("Chosen candidate",result.ranking().get(0).name());verify(meetings,never()).setMeetingPoint(anyInt(),anyInt(),any());
    }
    @Test void routeUsesAuthorizedStoredCoordinatesAndDiscardsResultWhenSharingIsRevokedMidRequest() {
        var access=mock(GroupAccessService.class);var locations=mock(UserLocationService.class);var meetings=mock(MeetingPointService.class);var routing=mock(WalkingRoutingService.class);var ai=mock(AiExplanationService.class);var meetingRepository=mock(MeetingPointRepository.class);
        var service=new NavigationAssistanceService(access,locations,meetings,routing,ai,meetingRepository,Clock.systemUTC());
        var own=new UserLocationDtoOut(1,"Private name",24.0,46.0,8.0,OffsetDateTime.now(ZoneOffset.UTC),true);
        var target=new UserLocationDtoOut(2,"Private target",24.001,46.001,8.0,OffsetDateTime.now(ZoneOffset.UTC),true);
        var hidden=new UserLocationDtoOut(2,"Private target",null,null,null,null,false);
        when(locations.getGroupLocations(1,10)).thenReturn(List.of(own,target),List.of(own,hidden));
        when(routing.route(24,46,24.001,46.001)).thenReturn(new Route("READY",List.of(List.of(24.0,46.0),List.of(24.001,46.001)),150.0,120.0,"",false));
        var result=service.walking(1,10,new Destination(2,false));
        verify(access,atLeast(2)).requireMember(1,10);verify(access,atLeast(2)).requireMember(2,10);verify(routing).route(24,46,24.001,46.001);
        assertEquals("LOCATION_UNAVAILABLE",result.status());assertTrue(result.coordinates().isEmpty());assertNull(result.distanceMeters());assertNull(result.durationSeconds());
    }
    @Test void reunionUsesWalkingDistanceWhenAvailableWithoutSendingIdentitiesOrCoordinatesToAi() {
        var access=mock(GroupAccessService.class);var locations=mock(UserLocationService.class);var meetings=mock(MeetingPointService.class);var routing=mock(WalkingRoutingService.class);var ai=mock(AiExplanationService.class);var meetingRepository=mock(MeetingPointRepository.class);
        var service=new NavigationAssistanceService(access,locations,meetings,routing,ai,meetingRepository,Clock.systemUTC());
        var own=new UserLocationDtoOut(1,"Private name",24.0,46.0,8.0,OffsetDateTime.now(ZoneOffset.UTC),true);
        var target=new UserLocationDtoOut(2,"Private target",24.001,46.001,8.0,OffsetDateTime.now(ZoneOffset.UTC),true);
        when(locations.getGroupLocations(1,10)).thenReturn(List.of(own,target));
        when(routing.cachedRoute(anyDouble(),anyDouble(),anyDouble(),anyDouble())).thenReturn(Optional.of(new Route("READY",List.of(),220.0,180.0,"",false)));
        when(ai.explain(anyMap())).thenAnswer(call->{Map<?,?> facts=call.getArgument(0);assertEquals(220.0,facts.get("walkingDistanceMeters"));String json=facts.toString();assertFalse(json.contains("Private"));assertFalse(json.contains("latitude"));assertFalse(json.contains("longitude"));assertFalse(facts.containsKey("userId"));return Optional.of("شرح اختبار معزول");});
        var result=service.reunion(1,10,new Destination(2,false));assertEquals(220.0,result.walkingDistanceMeters());assertEquals("OPENAI",result.source());verify(routing,never()).route(anyDouble(),anyDouble(),anyDouble(),anyDouble());
    }
}
