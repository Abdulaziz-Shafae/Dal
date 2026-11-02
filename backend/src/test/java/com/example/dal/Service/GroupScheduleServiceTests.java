package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.Model.Group;
import org.junit.jupiter.api.Test;
import java.time.*;
import static org.junit.jupiter.api.Assertions.*;

class GroupScheduleServiceTests {
    private final GroupScheduleService service = new GroupScheduleService();
    private LocalDateTime utc(String instant) { return LocalDateTime.ofInstant(Instant.parse(instant), ZoneOffset.UTC); }

    @Test void openScheduleIsActiveByDefault() {
        Group group = new Group();
        assertTrue(service.active(group, utc("2026-11-02T02:00:00Z")));
    }

    @Test void allDayScheduleOnlyEnablesSelectedDatesInRiyadh() {
        Group group = new Group();
        service.configure(group,"ALL_DAY",LocalDate.of(2026,11,2),LocalDate.of(2026,11,3),null,null);
        assertFalse(service.active(group,utc("2026-11-01T20:59:59Z")));
        assertTrue(service.active(group,utc("2026-11-01T21:00:00Z")));
        assertTrue(service.active(group,utc("2026-11-03T20:59:59Z")));
        assertFalse(service.active(group,utc("2026-11-03T21:00:00Z")));
    }

    @Test void timedSchedulePausesAndResumesEachDayButNeverReusesYesterdayLocation() {
        Group group = new Group();
        service.configure(group,"TIMED",LocalDate.of(2026,11,2),LocalDate.of(2026,11,4),LocalTime.of(9,0),LocalTime.of(17,0));
        assertFalse(service.active(group,utc("2026-11-02T05:59:59Z")));
        assertTrue(service.active(group,utc("2026-11-02T06:00:00Z")));
        assertFalse(service.active(group,utc("2026-11-02T14:00:00Z")));
        assertTrue(service.active(group,utc("2026-11-03T06:00:00Z")));
        assertFalse(service.freshWithinWindow(group,utc("2026-11-02T10:00:00Z"),utc("2026-11-03T06:01:00Z")));
        assertTrue(service.freshWithinWindow(group,utc("2026-11-03T06:00:30Z"),utc("2026-11-03T06:01:00Z")));
    }

    @Test void invalidDatesAndTimesAreRejected() {
        Group group = new Group();
        assertThrows(ApiException.class, () -> service.configure(group,"TIMED",LocalDate.of(2026,11,3),LocalDate.of(2026,11,2),LocalTime.of(9,0),LocalTime.of(17,0)));
        assertThrows(ApiException.class, () -> service.configure(group,"TIMED",LocalDate.of(2026,11,2),LocalDate.of(2026,11,3),LocalTime.of(17,0),LocalTime.of(9,0)));
    }
}
