package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.LocationDtoIn;
import com.example.dal.DtoOut.UserLocationDtoOut;
import com.example.dal.Model.*;
import com.example.dal.Repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class UserLocationService {

    public static final int ACTIVITY_LEASE_SECONDS = 90;

    private final UserLocationRepository locationRepository;
    private final GroupMemberRepository memberRepository;
    private final LocationSharingSettingsRepository settingsRepository;
    private final LocationSharingSettingsService sharingService;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;

    @Transactional
    public UserLocationDtoOut updateUserLocation(Integer userId, LocationDtoIn input) {
        LocalDateTime receivedAt = validationService.getCurrentTime();
        validationService.validateInput(input);
        User user = accessService.requireUserForUpdate(userId);
        if (!Double.isFinite(input.getLatitude()) || !Double.isFinite(input.getLongitude()) || (input.getAccuracy() != null && !Double.isFinite(input.getAccuracy()))) {
            throw new ApiException("Location values must be finite numbers");
        }
        LocationSharingSettings settings = sharingService.requireSettings(userId);
        if (!sharingService.isGlobalSharingEnabled(settings)) {
            throw new ApiException("Location sharing is currently disabled");
        }
        LocalDateTime recordedAt = validationService.convertToUtc(input.getRecordedAt());
        if (recordedAt.isAfter(validationService.getCurrentTime().plusSeconds(30))) {
            throw new ApiException("Recorded time must not be in the future");
        }
        if (recordedAt.isBefore(user.getCreatedAt())) {
            throw new ApiException("Recorded time must not be before account creation");
        }
        UserLocation latest = locationRepository.findFirstByUser_IdOrderByRecordedAtDescIdDesc(userId);
        if (latest != null && !recordedAt.isAfter(latest.getRecordedAt())) {
            // Stationary heartbeat: authenticate activity without inventing a GPS timestamp.
            if (recordedAt.equals(latest.getRecordedAt()) && belongsToPeriod(latest, settings, null) && Objects.equals(input.getLatitude(), latest.getLatitude()) && Objects.equals(input.getLongitude(), latest.getLongitude()) && Objects.equals(input.getAccuracy(), latest.getAccuracy())) {
                if (receivedAt.isAfter(latest.getActivityAt())) latest.setActivityAt(receivedAt);
                locationRepository.save(latest);
            }
            return createLocationResponse(user, latest, settings, null);
        }
        if (recordedAt.isBefore(validationService.getCurrentTime().minusSeconds(30))) throw new ApiException("A fresh GPS measurement is required");
        UserLocation location = new UserLocation();
        location.setUser(user);
        location.setLatitude(input.getLatitude());
        location.setLongitude(input.getLongitude());
        location.setAccuracy(input.getAccuracy());
        location.setRecordedAt(recordedAt);
        location.setActivityAt(receivedAt);
        // Do not replace a currently authorized fix with a sample outside the
        // current period (including clock-skewed samples beyond schedule end).
        if (!belongsToPeriod(location, settings, null)) return createLocationResponse(user, latest, settings, null);
        locationRepository.save(location);
        return createLocationResponse(user, location, settings, null);
    }

    @Transactional(readOnly = true)
    public UserLocationDtoOut getMyLatestLocation(Integer userId) {
        User user = accessService.requireUser(userId);
        LocationSharingSettings settings = settingsRepository.findByUser_Id(userId);
        boolean enabled = sharingService.isGlobalSharingEnabled(settings);
        UserLocation location = enabled ? locationRepository.findFirstByUser_IdOrderByRecordedAtDescIdDesc(userId) : null;
        return createLocationResponse(user, location, settings, null);
    }

    @Transactional(readOnly = true)
    public List<UserLocationDtoOut> getGroupLocations(Integer userId, Integer groupId) {
        accessService.requireMember(userId, groupId);
        List<UserLocationDtoOut> result = new ArrayList<>();
        for (GroupMember member : memberRepository.findAllByGroup_Id(groupId)) {
            User user = member.getUser();
            LocationSharingSettings settings = settingsRepository.findByUser_Id(user.getId());
            boolean enabled = sharingService.isSharingEnabledForMember(member, settings);
            UserLocation location = enabled ? locationRepository.findFirstByUser_IdOrderByRecordedAtDescIdDesc(user.getId()) : null;
            result.add(createLocationResponse(user, location, settings, member));
        }
        return result;
    }

    @Transactional
    public void deleteMyLocationHistory(Integer userId) {
        accessService.requireUserForUpdate(userId);
        locationRepository.deleteByUser_Id(userId);
    }

    private LocalDateTime boundary(LocationSharingSettings settings, GroupMember member) {
        LocalDateTime boundary = settings.getLocationsValidFrom();
        if ("SCHEDULED".equals(settings.getSharingMode())) boundary = later(boundary, settings.getStartTime());
        if (Boolean.TRUE.equals(settings.getIsPaused())) boundary = later(boundary, settings.getPausedUntil());
        if (member != null) {
            boundary = later(boundary, member.getJoinedAt());
            boundary = later(boundary, member.getLocationsValidFrom());
            if (Boolean.TRUE.equals(member.getLocationSharingPaused())) boundary = later(boundary, member.getLocationSharingPausedUntil());
            if ("PAUSED".equals(member.getGroup().getStatus())) boundary = later(boundary, member.getGroup().getPausedUntil());
        }
        return boundary;
    }

    private LocalDateTime later(LocalDateTime a, LocalDateTime b) { return a == null ? b : b == null || a.isAfter(b) ? a : b; }

    private boolean belongsToPeriod(UserLocation location, LocationSharingSettings settings, GroupMember member) {
        if (location == null || location.getActivityAt() == null || location.getRecordedAt() == null || settings == null) return false;
        // Strict authorization boundaries also fail closed if pause/resume shares
        // a clock tick with the previous sample. Schedule start remains inclusive.
        if (!afterAuthorization(location, settings.getLocationsValidFrom())) return false;
        if (member != null && (member.getJoinedAt() == null || !afterAuthorization(location, member.getLocationsValidFrom()) || !afterAuthorization(location, member.getJoinedAt()))) return false;
        if ("SCHEDULED".equals(settings.getSharingMode()) && (settings.getEndTime() == null || !location.getRecordedAt().isBefore(settings.getEndTime()))) return false;
        LocalDateTime from = boundary(settings, member);
        return from == null || (!location.getRecordedAt().isBefore(from) && !location.getActivityAt().isBefore(from));
    }

    private boolean afterAuthorization(UserLocation location, LocalDateTime boundary) {
        return boundary == null || (location.getRecordedAt().isAfter(boundary) && location.getActivityAt().isAfter(boundary));
    }

    private UserLocationDtoOut createLocationResponse(User user, UserLocation location, LocationSharingSettings settings, GroupMember member) {
        boolean enabled = member == null ? sharingService.isGlobalSharingEnabled(settings) : sharingService.isSharingEnabledForMember(member, settings);
        String mode = settings == null ? null : settings.getSharingMode();
        LocalDateTime until = location == null || settings == null ? null : "SCHEDULED".equals(mode) ? settings.getEndTime() : "WHILE_USING".equals(mode) && location.getActivityAt() != null ? location.getActivityAt().plusSeconds(ACTIVITY_LEASE_SECONDS) : null;
        enabled = enabled && belongsToPeriod(location, settings, member) && (!"WHILE_USING".equals(mode) || until != null) && (until == null || validationService.getCurrentTime().isBefore(until));
        UserLocation visible = enabled ? location : null;
        return new UserLocationDtoOut(user.getId(), user.getName(), visible == null ? null : visible.getLatitude(), visible == null ? null : visible.getLongitude(), visible == null ? null : visible.getAccuracy(), validationService.convertForResponse(visible == null ? null : visible.getRecordedAt()), enabled, validationService.convertForResponse(enabled ? until : null));
    }
}
