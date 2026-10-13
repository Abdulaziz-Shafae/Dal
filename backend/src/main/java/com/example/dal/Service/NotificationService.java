package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.NudgeDtoIn;
import com.example.dal.DtoOut.NotificationDtoOut;
import com.example.dal.Model.*;
import com.example.dal.Repository.NotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;

    @Transactional(readOnly = true)
    public long unreadCount(Integer userId) {
        accessService.requireUser(userId);
        return notificationRepository.countByReceiver_IdAndReadAtIsNull(userId);
    }

    @Transactional
    public NotificationDtoOut nudgeGroupMember(Integer userId, Integer groupId, Integer receiverId, NudgeDtoIn input) {
        validationService.validateInput(input);
        Group group = accessService.requireGroupForUpdate(groupId);
        accessService.requireOpenGroup(group);
        GroupMember sender = accessService.requireMember(userId, groupId);
        GroupMember receiver = accessService.requireMember(receiverId, groupId);
        if (userId.equals(receiverId)) {
            throw new ApiException("You cannot nudge yourself");
        }
        Notification previous = notificationRepository.findFirstBySender_IdAndReceiver_IdAndGroup_IdAndTypeOrderByCreatedAtDescIdDesc(userId, receiverId, groupId, "NUDGE");
        if (previous != null && previous.getCreatedAt().isAfter(validationService.getCurrentTime().minusSeconds(30))) {
            throw new ApiException("Wait 30 seconds before nudging this member again");
        }
        String content = "WHERE_ARE_YOU".equals(input.getMessage()) ? "Where are you?" : "I am on my way";
        return createNotificationResponse(saveGroupNotification(group, sender.getUser(), receiver.getUser(), "NUDGE", content));
    }

    @Transactional(readOnly = true)
    public Page<NotificationDtoOut> getMyNotifications(Integer userId, int page, int size) {
        accessService.requireUser(userId);
        validationService.validatePagination(page, size);
        return notificationRepository.findAllByReceiver_Id(userId, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"))).map(this::createNotificationResponse);
    }

    @Transactional
    public NotificationDtoOut markNotificationRead(Integer userId, Integer notificationId) {
        accessService.requireUserForUpdate(userId);
        Notification notification = notificationId == null ? null : notificationRepository.findNotificationById(notificationId);
        if (notification == null || !notification.getReceiver().getId().equals(userId)) {
            throw new ApiException("Notification not found");
        }
        if (notification.getReadAt() == null) {
            notification.setReadAt(validationService.getCurrentTime());
            notificationRepository.save(notification);
        }
        return createNotificationResponse(notification);
    }

    // Internal workflow helper; no public Controller should expose this method directly.
    @Transactional
    public Notification saveGroupNotification(Group group, User sender, User receiver, String type, String content) {
        if (sender.getId().equals(receiver.getId())) {
            throw new ApiException("Notification sender and receiver must be different");
        }
        accessService.requireMember(sender.getId(), group.getId());
        accessService.requireMember(receiver.getId(), group.getId());
        Notification notification = new Notification();
        notification.setGroup(group);
        notification.setSender(sender);
        notification.setReceiver(receiver);
        notification.setType(type);
        notification.setContent(content);
        return notificationRepository.saveAndFlush(notification);
    }

    private NotificationDtoOut createNotificationResponse(Notification notification) {
        return new NotificationDtoOut(notification.getId(), notification.getGroup().getId(), notification.getSender().getId(), notification.getSender().getName(), notification.getType(), notification.getContent(), validationService.convertForResponse(notification.getCreatedAt()), validationService.convertForResponse(notification.getReadAt()));
    }
}
