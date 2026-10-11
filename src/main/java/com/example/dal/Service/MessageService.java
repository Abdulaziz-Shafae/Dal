package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.SendMessageDtoIn;
import com.example.dal.DtoOut.MessageDtoOut;
import com.example.dal.Model.*;
import com.example.dal.Repository.MessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final MessageRepository messageRepository;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;
    private final NotificationService notificationService;

    @Transactional
    public MessageDtoOut sendMessage(Integer userId, Integer groupId, Integer receiverId, SendMessageDtoIn input) {
        validationService.validateInput(input);
        Group group = accessService.requireGroupForUpdate(groupId);
        accessService.requireOpenGroup(group);
        GroupMember sender = accessService.requireMember(userId, groupId);
        GroupMember receiver = accessService.requireMember(receiverId, groupId);
        if (userId.equals(receiverId)) {
            throw new ApiException("You cannot send a message to yourself");
        }
        accessService.requireUserForUpdate(userId);
        Message existing = messageRepository.findBySender_IdAndClientMessageId(userId, input.getClientMessageId());
        if (existing != null) {
            if (!existing.getGroup().getId().equals(groupId) || !existing.getReceiver().getId().equals(receiverId) || !existing.getContent().equals(input.getContent().trim())) {
                throw new ApiException("Client message ID was already used for a different message");
            }
            return createMessageResponse(existing);
        }
        Message message = new Message();
        message.setGroup(group);
        message.setSender(sender.getUser());
        message.setReceiver(receiver.getUser());
        message.setContent(input.getContent().trim());
        message.setClientMessageId(input.getClientMessageId());
        messageRepository.saveAndFlush(message);
        notificationService.saveGroupNotification(group, sender.getUser(), receiver.getUser(), "MESSAGE", "You have a new message");
        return createMessageResponse(message);
    }

    @Transactional(readOnly = true)
    public Page<MessageDtoOut> getConversation(Integer userId, Integer groupId, Integer otherUserId, int page, int size) {
        accessService.requireMember(userId, groupId);
        accessService.requireMember(otherUserId, groupId);
        if (userId.equals(otherUserId)) {
            throw new ApiException("Select another group member");
        }
        validationService.validatePagination(page, size);
        return messageRepository.findConversation(groupId, userId, otherUserId, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id"))).map(this::createMessageResponse);
    }

    @Transactional
    public MessageDtoOut markMessageRead(Integer userId, Integer messageId) {
        accessService.requireUserForUpdate(userId);
        Message message = messageId == null ? null : messageRepository.findMessageById(messageId);
        if (message == null || !message.getReceiver().getId().equals(userId)) {
            throw new ApiException("Message not found");
        }
        accessService.requireMember(userId, message.getGroup().getId());
        if (message.getReadAt() == null) {
            message.setReadAt(validationService.getCurrentTime());
            messageRepository.save(message);
        }
        return createMessageResponse(message);
    }

    private MessageDtoOut createMessageResponse(Message message) {
        return new MessageDtoOut(message.getId(), message.getGroup().getId(), message.getSender().getId(), message.getSender().getName(), message.getReceiver().getId(), message.getContent(), message.getClientMessageId(), validationService.convertForResponse(message.getCreatedAt()), validationService.convertForResponse(message.getReadAt()));
    }
}
