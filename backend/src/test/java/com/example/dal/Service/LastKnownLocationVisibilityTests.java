package com.example.dal.Service;

import com.example.dal.Model.LocationSharingSettings;
import com.example.dal.Model.UserLocation;
import org.junit.jupiter.api.Test;
import java.time.LocalDateTime;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class LastKnownLocationVisibilityTests {
    @Test void scheduledVisibleUntilEndAndNotBeforeStart() {
        InputValidationService time = mock(InputValidationService.class);
        LocationSharingSettingsService service = new LocationSharingSettingsService(null, null, null, time);
        LocalDateTime start = LocalDateTime.of(2026, 10, 14, 16, 0);
        LocalDateTime end = start.plusHours(6);
        LocationSharingSettings settings = new LocationSharingSettings();
        settings.setSharingMode("SCHEDULED"); settings.setStartTime(start); settings.setEndTime(end);
        UserLocation location = new UserLocation(); location.setRecordedAt(start.plusHours(2));
        when(time.getCurrentTime()).thenReturn(end.minusSeconds(1));
        assertTrue(service.isStoredLocationVisible(settings, location)); assertEquals(end, service.getLocationVisibilityEnd(settings));
        when(time.getCurrentTime()).thenReturn(end);
        assertFalse(service.isStoredLocationVisible(settings, location));
        location.setRecordedAt(start.minusSeconds(1));
        when(time.getCurrentTime()).thenReturn(start.plusHours(1));
        assertFalse(service.isStoredLocationVisible(settings, location));
    }

    @Test void whileUsingExpiresAndAlwaysPersists() {
        InputValidationService time = mock(InputValidationService.class);
        LocationSharingSettingsService service = new LocationSharingSettingsService(null, null, null, time);
        LocalDateTime activity = LocalDateTime.of(2026, 10, 14, 18, 0);
        LocationSharingSettings settings = new LocationSharingSettings(); settings.setSharingMode("WHILE_USING"); settings.setLastActiveAt(activity);
        UserLocation location = new UserLocation(); location.setRecordedAt(activity);
        when(time.getCurrentTime()).thenReturn(activity.plusSeconds(89));
        assertTrue(service.isStoredLocationVisible(settings, location));
        when(time.getCurrentTime()).thenReturn(activity.plusSeconds(90));
        assertFalse(service.isStoredLocationVisible(settings, location));
        settings.setSharingMode("ALWAYS");
        when(time.getCurrentTime()).thenReturn(activity.plusDays(5));
        assertTrue(service.isStoredLocationVisible(settings, location));
        settings.setIsPaused(true);
        assertFalse(service.isStoredLocationVisible(settings, location));
    }
}
