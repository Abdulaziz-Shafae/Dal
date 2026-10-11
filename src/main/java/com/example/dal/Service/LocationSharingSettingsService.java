package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.*;
import com.example.dal.DtoOut.*;
import com.example.dal.Model.*;
import com.example.dal.Repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class LocationSharingSettingsService {

    private final LocationSharingSettingsRepository settingsRepository;
    private final GroupMemberRepository memberRepository;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;

    @Transactional(readOnly = true)
    public SharingSettingsDtoOut getSharingSettings(Integer userId) {
        accessService.requireUser(userId);
        return createSettingsResponse(requireSettings(userId));
    }

    @Transactional
    public SharingSettingsDtoOut updateSharingSettings(Integer userId, SharingSettingsDtoIn input) {
        validationService.validateInput(input);
        accessService.requireUserForUpdate(userId);
        LocationSharingSettings settings = requireSettings(userId);
        LocalDateTime start = validationService.convertToUtc(input.getStartTime());
        LocalDateTime end = validationService.convertToUtc(input.getEndTime());
        if ("SCHEDULED".equals(input.getSharingMode()) && (start == null || end == null || !start.isBefore(end))) {
            throw new ApiException("Scheduled sharing requires a start time before the end time");
        }
        settings.setSharingMode(input.getSharingMode());
        settings.setStartTime("SCHEDULED".equals(input.getSharingMode()) ? start : null);
        settings.setEndTime("SCHEDULED".equals(input.getSharingMode()) ? end : null);
        settings.setUpdateIntervalSeconds(input.getUpdateIntervalSeconds());
        settingsRepository.saveAndFlush(settings);
        return createSettingsResponse(settings);
    }

    @Transactional
    public SharingSettingsDtoOut pauseAllLocationSharing(Integer userId, PauseDtoIn input) {
        validationService.validateInput(input);
        accessService.requireUserForUpdate(userId);
        LocationSharingSettings settings = requireSettings(userId);
        settings.setPausedUntil(validationService.validatePauseUntil(input.getPausedUntil()));
        settings.setIsPaused(true);
        settingsRepository.saveAndFlush(settings);
        return createSettingsResponse(settings);
    }

    @Transactional
    public SharingSettingsDtoOut resumeAllLocationSharing(Integer userId) {
        accessService.requireUserForUpdate(userId);
        LocationSharingSettings settings = requireSettings(userId);
        settings.setIsPaused(false);
        settings.setPausedUntil(null);
        settingsRepository.saveAndFlush(settings);
        // This does not override paused memberships or paused groups.
        return createSettingsResponse(settings);
    }

    @Transactional
    public MemberSharingDtoOut pauseSharingForGroup(Integer userId, Integer groupId, PauseDtoIn input) {
        validationService.validateInput(input);
        accessService.requireGroupForUpdate(groupId);
        GroupMember member = accessService.requireMember(userId, groupId);
        member.setLocationSharingPausedUntil(validationService.validatePauseUntil(input.getPausedUntil()));
        member.setLocationSharingPaused(true);
        memberRepository.save(member);
        return createMemberSharingResponse(member);
    }

    @Transactional
    public MemberSharingDtoOut resumeSharingForGroup(Integer userId, Integer groupId) {
        accessService.requireGroupForUpdate(groupId);
        GroupMember member = accessService.requireMember(userId, groupId);
        member.setLocationSharingPaused(false);
        member.setLocationSharingPausedUntil(null);
        memberRepository.save(member);
        return createMemberSharingResponse(member);
    }

    @Transactional(readOnly = true)
    public MemberSharingDtoOut getSharingForGroup(Integer userId, Integer groupId) {
        return createMemberSharingResponse(accessService.requireMember(userId, groupId));
    }

    public boolean isGlobalSharingEnabled(LocationSharingSettings settings) {
        if (settings == null) {
            return false;
        }
        LocalDateTime now = validationService.getCurrentTime();
        if (isPauseActive(settings.getIsPaused(), settings.getPausedUntil(), now)) {
            return false;
        }
        if ("SCHEDULED".equals(settings.getSharingMode())) {
            return settings.getStartTime() != null && settings.getEndTime() != null && !now.isBefore(settings.getStartTime()) && now.isBefore(settings.getEndTime());
        }
        // WHILE_USING is enforced by the frontend only while the page is in use.
        return "WHILE_USING".equals(settings.getSharingMode()) || "ALWAYS".equals(settings.getSharingMode());
    }

    public boolean isSharingEnabledForMember(GroupMember member, LocationSharingSettings settings) {
        LocalDateTime now = validationService.getCurrentTime();
        Group group = member.getGroup();
        if ("CLOSED".equals(group.getStatus()) || isPauseActive("PAUSED".equals(group.getStatus()), group.getPausedUntil(), now)) {
            return false;
        }
        return isGlobalSharingEnabled(settings) && !isPauseActive(member.getLocationSharingPaused(), member.getLocationSharingPausedUntil(), now);
    }

    private boolean isPauseActive(Boolean paused, LocalDateTime until, LocalDateTime now) {
        return Boolean.TRUE.equals(paused) && (until == null || until.isAfter(now));
    }

    public LocationSharingSettings requireSettings(Integer userId) {
        LocationSharingSettings settings = settingsRepository.findByUser_Id(userId);
        if (settings == null) {
            throw new ApiException("Location sharing settings not found");
        }
        return settings;
    }

    private SharingSettingsDtoOut createSettingsResponse(LocationSharingSettings settings) {
        boolean paused = isPauseActive(settings.getIsPaused(), settings.getPausedUntil(), validationService.getCurrentTime());
        return new SharingSettingsDtoOut(settings.getSharingMode(), validationService.convertForResponse(settings.getStartTime()), validationService.convertForResponse(settings.getEndTime()), paused, validationService.convertForResponse(paused ? settings.getPausedUntil() : null), settings.getUpdateIntervalSeconds(), isGlobalSharingEnabled(settings), validationService.convertForResponse(settings.getUpdatedAt()));
    }

    private MemberSharingDtoOut createMemberSharingResponse(GroupMember member) {
        boolean paused = isPauseActive(member.getLocationSharingPaused(), member.getLocationSharingPausedUntil(), validationService.getCurrentTime());
        return new MemberSharingDtoOut(member.getGroup().getId(), paused, validationService.convertForResponse(paused ? member.getLocationSharingPausedUntil() : null), isSharingEnabledForMember(member, requireSettings(member.getUser().getId())));
    }
}
