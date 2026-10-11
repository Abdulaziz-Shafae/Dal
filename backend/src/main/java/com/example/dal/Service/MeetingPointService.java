package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.MeetingPointDtoIn;
import com.example.dal.DtoOut.MeetingPointDtoOut;
import com.example.dal.Model.*;
import com.example.dal.Repository.MeetingPointRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MeetingPointService {

    private final MeetingPointRepository meetingPointRepository;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;

    @Transactional
    public MeetingPointDtoOut setMeetingPoint(Integer userId, Integer groupId, MeetingPointDtoIn input) {
        validationService.validateInput(input);
        if (!Double.isFinite(input.getLatitude()) || !Double.isFinite(input.getLongitude())) {
            throw new ApiException("Coordinates must be finite numbers");
        }
        Group group = accessService.requireGroupForUpdate(groupId);
        accessService.requireManager(userId, groupId);
        accessService.requireOpenGroup(group);
        MeetingPoint point = meetingPointRepository.findByGroup_Id(groupId);
        if (point == null) {
            point = new MeetingPoint();
            point.setGroup(group);
            point.setCreatedBy(accessService.requireUser(userId));
        }
        point.setName(input.getName().trim());
        point.setLatitude(input.getLatitude());
        point.setLongitude(input.getLongitude());
        meetingPointRepository.saveAndFlush(point);
        return createMeetingPointResponse(point);
    }

    @Transactional(readOnly = true)
    public MeetingPointDtoOut getGroupMeetingPoint(Integer userId, Integer groupId) {
        accessService.requireMember(userId, groupId);
        MeetingPoint point = meetingPointRepository.findByGroup_Id(groupId);
        if (point == null) {
            throw new ApiException("This group has no meeting point yet");
        }
        return createMeetingPointResponse(point);
    }

    @Transactional
    public void deleteMeetingPoint(Integer userId, Integer groupId) {
        Group group = accessService.requireGroupForUpdate(groupId);
        accessService.requireManager(userId, groupId);
        accessService.requireOpenGroup(group);
        MeetingPoint point = meetingPointRepository.findByGroup_Id(groupId);
        if (point == null) {
            throw new ApiException("Meeting point not found");
        }
        meetingPointRepository.delete(point);
    }

    private MeetingPointDtoOut createMeetingPointResponse(MeetingPoint point) {
        return new MeetingPointDtoOut(point.getId(), point.getGroup().getId(), point.getName(), point.getLatitude(), point.getLongitude(), point.getCreatedBy().getId(), validationService.convertForResponse(point.getCreatedAt()), validationService.convertForResponse(point.getUpdatedAt()));
    }
}
