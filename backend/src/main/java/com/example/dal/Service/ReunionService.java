package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoOut.ReunionDtoOut;
import com.example.dal.Model.*;
import com.example.dal.Repository.ReunionEventRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ReunionService {

    private final ReunionEventRepository reunionRepository;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;
    private final NotificationService notificationService;

    @Transactional
    public ReunionDtoOut recordArrival(Integer userId, Integer groupId, Integer targetUserId) {
        Group group = accessService.requireGroupForUpdate(groupId);
        accessService.requireOpenGroup(group);
        GroupMember member = accessService.requireMember(userId, groupId);
        GroupMember target = accessService.requireMember(targetUserId, groupId);
        if (userId.equals(targetUserId)) {
            throw new ApiException("Select another group member");
        }
        ReunionEvent previous = reunionRepository.findFirstByUser_IdAndTargetUser_IdAndGroup_IdOrderByArrivedAtDescIdDesc(userId, targetUserId, groupId);
        if (previous != null && previous.getArrivedAt().isAfter(validationService.getCurrentTime().minusSeconds(30))) {
            return createReunionResponse(previous);
        }
        ReunionEvent event = new ReunionEvent();
        event.setGroup(group);
        event.setUser(member.getUser());
        event.setTargetUser(target.getUser());
        reunionRepository.saveAndFlush(event);
        notificationService.saveGroupNotification(group, member.getUser(), target.getUser(), "ARRIVED", "I have arrived");
        // Arrival is a manual confirmation, not a claim of precise GPS proximity.
        return createReunionResponse(event);
    }

    private ReunionDtoOut createReunionResponse(ReunionEvent event) {
        return new ReunionDtoOut(event.getId(), event.getGroup().getId(), event.getUser().getId(), event.getTargetUser().getId(), validationService.convertForResponse(event.getArrivedAt()));
    }
}
