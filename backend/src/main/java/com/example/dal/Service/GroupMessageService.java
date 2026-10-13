package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.SendMessageDtoIn;
import com.example.dal.Model.*;
import com.example.dal.Repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.OffsetDateTime;

@Service @RequiredArgsConstructor
public class GroupMessageService {
    private final GroupMessageRepository repository;
    private final GroupMessageReadRepository reads;
    private final GroupMemberRepository members;
    private final GroupAccessService access;
    private final InputValidationService validation;
    private final NotificationService notifications;
    public record MessageOutput(Integer id,Integer groupId,Integer senderId,String senderName,String content,String clientMessageId,OffsetDateTime createdAt) {}
    private MessageOutput output(GroupMessage m) {return new MessageOutput(m.getId(),m.getGroup().getId(),m.getSender().getId(),m.getSender().getName(),m.getContent(),m.getClientMessageId(),validation.convertForResponse(m.getCreatedAt()));}
    @Transactional public MessageOutput send(Integer userId,Integer groupId,SendMessageDtoIn input) {
        validation.validateInput(input);
        Group group=access.requireGroupForUpdate(groupId); access.requireOpenGroup(group);
        GroupMember sender=access.requireMember(userId,groupId); access.requireUserForUpdate(userId);
        GroupMessage existing=repository.findBySender_IdAndClientMessageId(userId,input.getClientMessageId());
        if(existing!=null) {
            if(!existing.getGroup().getId().equals(groupId)||!existing.getContent().equals(input.getContent().trim())) throw new ApiException("Client message ID was already used for a different message");
            return output(existing);
        }
        GroupMessage m=new GroupMessage(); m.setGroup(group);m.setSender(sender.getUser());m.setContent(input.getContent().trim());m.setClientMessageId(input.getClientMessageId()); repository.saveAndFlush(m);
        for(GroupMember member:members.findAllByGroup_Id(groupId)) if(!member.getUser().getId().equals(userId)) notifications.saveGroupNotification(group,sender.getUser(),member.getUser(),"MESSAGE","You have a new group message");
        return output(m);
    }
    @Transactional(readOnly=true) public Page<MessageOutput> conversation(Integer userId,Integer groupId,int page,int size) {
        access.requireMember(userId,groupId);validation.validatePagination(page,size);
        return repository.findAllByGroup_Id(groupId,PageRequest.of(page,size,Sort.by(Sort.Direction.DESC,"id"))).map(this::output);
    }
    @Transactional public void read(Integer userId,Integer groupId,Integer messageId) {
        access.requireMember(userId,groupId);access.requireUserForUpdate(userId);
        GroupMessage m=repository.findById(messageId).orElseThrow(()->new ApiException("Message not found"));
        if(!m.getGroup().getId().equals(groupId)) throw new ApiException("Message not found");
        GroupMessageRead r=reads.findByGroup_IdAndUser_Id(groupId,userId);
        if(r==null) {r=new GroupMessageRead();r.setGroup(m.getGroup());r.setUser(access.requireUser(userId));}
        r.setLastMessageId(Math.max(r.getLastMessageId(),messageId));reads.save(r);
    }
    @Transactional(readOnly=true) public long unread(Integer userId,Integer groupId) {
        access.requireMember(userId,groupId);
        GroupMessageRead r=reads.findByGroup_IdAndUser_Id(groupId,userId);
        return repository.countByGroup_IdAndSender_IdNotAndIdGreaterThan(groupId,userId,r==null?0:r.getLastMessageId());
    }
}
