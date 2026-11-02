package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.Model.Group;
import org.springframework.stereotype.Service;
import java.time.*;

@Service
public class GroupScheduleService {
    private static final ZoneId RIYADH = ZoneId.of("Asia/Riyadh");

    public void configure(Group group, String mode, LocalDate start, LocalDate end, LocalTime from, LocalTime until) {
        if (!"OPEN".equals(mode) && !"ALL_DAY".equals(mode) && !"TIMED".equals(mode)) throw new ApiException("Invalid event schedule mode");
        if (!"OPEN".equals(mode) && (start == null || end == null || end.isBefore(start) || end.isAfter(start.plusDays(365)))) throw new ApiException("Choose valid event dates within one year");
        if ("TIMED".equals(mode) && (from == null || until == null || !from.isBefore(until))) throw new ApiException("Choose daily start time before end time");
        group.setScheduleMode(mode);
        group.setEventStartDate("OPEN".equals(mode) ? null : start);
        group.setEventEndDate("OPEN".equals(mode) ? null : end);
        group.setDailyStartTime("TIMED".equals(mode) ? from : null);
        group.setDailyEndTime("TIMED".equals(mode) ? until : null);
    }

    public boolean active(Group group, LocalDateTime utc) {
        if (group == null || "CLOSED".equals(group.getStatus())) return false;
        String mode = group.getScheduleMode();
        if (mode == null || "OPEN".equals(mode)) return true;
        ZonedDateTime local = utc.atOffset(ZoneOffset.UTC).atZoneSameInstant(RIYADH);
        LocalDate date = local.toLocalDate();
        if (group.getEventStartDate() == null || group.getEventEndDate() == null || date.isBefore(group.getEventStartDate()) || date.isAfter(group.getEventEndDate())) return false;
        if ("ALL_DAY".equals(mode)) return true;
        return "TIMED".equals(mode) && group.getDailyStartTime() != null && group.getDailyEndTime() != null && !local.toLocalTime().isBefore(group.getDailyStartTime()) && local.toLocalTime().isBefore(group.getDailyEndTime());
    }

    public boolean freshWithinWindow(Group group, LocalDateTime recordedAt, LocalDateTime now) {
        if (!active(group, now) || recordedAt == null) return false;
        String mode = group.getScheduleMode();
        if (mode == null || "OPEN".equals(mode)) return true;
        ZonedDateTime nowLocal = now.atOffset(ZoneOffset.UTC).atZoneSameInstant(RIYADH);
        LocalDateTime startLocal = nowLocal.toLocalDate().atTime("TIMED".equals(mode) ? group.getDailyStartTime() : LocalTime.MIDNIGHT);
        LocalDateTime startUtc = startLocal.atZone(RIYADH).withZoneSameInstant(ZoneOffset.UTC).toLocalDateTime();
        return !recordedAt.isBefore(startUtc) && !recordedAt.isAfter(now);
    }
}
