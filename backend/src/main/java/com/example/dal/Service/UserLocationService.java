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

@Service
@RequiredArgsConstructor
public class UserLocationService {

    private final UserLocationRepository locationRepository;
    private final GroupMemberRepository memberRepository;
    private final LocationSharingSettingsRepository settingsRepository;
    private final LocationSharingSettingsService sharingService;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;

    @Transactional
    public UserLocationDtoOut updateUserLocation(Integer userId, LocationDtoIn input) {
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
            return createLocationResponse(user, latest, true, sharingService.getLocationVisibilityEnd(settings));
        }
        UserLocation location = new UserLocation();
        location.setUser(user);
        location.setLatitude(input.getLatitude());
        location.setLongitude(input.getLongitude());
        location.setAccuracy(input.getAccuracy());
        location.setRecordedAt(recordedAt);
        locationRepository.save(location);
        if ("WHILE_USING".equals(settings.getSharingMode())) { settings.setLastActiveAt(validationService.getCurrentTime()); settingsRepository.saveAndFlush(settings); }
        return createLocationResponse(user, location, true, sharingService.getLocationVisibilityEnd(settings));
    }

    @Transactional(readOnly = true)
    public UserLocationDtoOut getMyLatestLocation(Integer userId) {
        User user = accessService.requireUser(userId);
        LocationSharingSettings settings = settingsRepository.findByUser_Id(userId);
        UserLocation latest = sharingService.isGlobalSharingEnabled(settings) ? locationRepository.findFirstByUser_IdOrderByRecordedAtDescIdDesc(userId) : null;
        boolean enabled = sharingService.isStoredLocationVisible(settings, latest);
        return createLocationResponse(user, enabled ? latest : null, enabled, enabled ? sharingService.getLocationVisibilityEnd(settings) : null);
    }

    @Transactional(readOnly = true)
    public List<UserLocationDtoOut> getGroupLocations(Integer userId, Integer groupId) {
        accessService.requireMember(userId, groupId);
        List<UserLocationDtoOut> result = new ArrayList<>();
        for (GroupMember member : memberRepository.findAllByGroup_Id(groupId)) {
            User user = member.getUser();
            LocationSharingSettings settings = settingsRepository.findByUser_Id(user.getId());
            boolean permitted = sharingService.isSharingEnabledForMember(member, settings);
            UserLocation latest = permitted ? locationRepository.findFirstByUser_IdOrderByRecordedAtDescIdDesc(user.getId()) : null;
            boolean enabled = permitted && sharingService.isStoredLocationVisible(settings, latest);
            result.add(createLocationResponse(user, enabled ? latest : null, enabled, enabled ? sharingService.getLocationVisibilityEnd(settings) : null));
        }
        return result;
    }

    @Transactional
    public void recordWhileUsingActivity(Integer userId, Integer groupId) {
        sharingService.recordWhileUsingActivity(userId, groupId);
    }

    @Transactional
    public void deleteMyLocationHistory(Integer userId) {
        accessService.requireUserForUpdate(userId);
        locationRepository.deleteByUser_Id(userId);
    }

    private UserLocationDtoOut createLocationResponse(User user, UserLocation location, boolean enabled, LocalDateTime visibleUntil) {
        UserLocationDtoOut response = new UserLocationDtoOut(user.getId(), user.getName(), location == null ? null : location.getLatitude(), location == null ? null : location.getLongitude(), location == null ? null : location.getAccuracy(), validationService.convertForResponse(location == null ? null : location.getRecordedAt()), enabled);
        response.setVisibleUntil(validationService.convertForResponse(visibleUntil));
        return response;
    }
}
