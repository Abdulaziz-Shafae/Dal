package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.MemberRoleDtoIn;
import com.example.dal.DtoOut.GroupMemberDtoOut;
import com.example.dal.Model.*;
import com.example.dal.Repository.GroupMemberRepository;
import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GroupMemberService {

    private final EntityManager entityManager;

    private final GroupMemberRepository memberRepository;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;

    @Transactional(readOnly = true)
    public List<GroupMemberDtoOut> getGroupMembers(Integer userId, Integer groupId) {
        accessService.requireMember(userId, groupId);
        return memberRepository.findAllByGroup_Id(groupId).stream().map(this::createMemberResponse).toList();
    }

    @Transactional
    public void leaveGroup(Integer userId, Integer groupId) {
        accessService.requireGroupForUpdate(groupId);
        GroupMember member = accessService.requireMember(userId, groupId);
        if ("OWNER".equals(member.getRole())) {
            throw new ApiException("Transfer ownership before leaving the group. You can close the group and keep your owner membership instead");
        }
        memberRepository.delete(member);
    }

    @Transactional
    public GroupMemberDtoOut updateMemberRole(Integer userId, Integer memberId, MemberRoleDtoIn input) {
        validationService.validateInput(input);
        GroupMember target = requireTargetMember(memberId);
        Group group = accessService.requireGroupForUpdate(target.getGroup().getId());
        entityManager.refresh(target);
        accessService.requireOwner(userId, group.getId());
        accessService.requireOpenGroup(group);
        if ("OWNER".equals(target.getRole())) {
            throw new ApiException("Use ownership transfer to change the owner");
        }
        target.setRole(input.getRole());
        memberRepository.save(target);
        return createMemberResponse(target);
    }

    @Transactional
    public void removeGroupMember(Integer userId, Integer memberId) {
        GroupMember target = requireTargetMember(memberId);
        Group group = accessService.requireGroupForUpdate(target.getGroup().getId());
        entityManager.refresh(target);
        GroupMember actor = accessService.requireManager(userId, group.getId());
        accessService.requireOpenGroup(group);
        if (target.getUser().getId().equals(userId)) {
            throw new ApiException("Use leave group to remove your own membership");
        }
        if ("OWNER".equals(target.getRole())) {
            throw new ApiException("The group owner cannot be removed");
        }
        if ("ADMIN".equals(actor.getRole()) && !"MEMBER".equals(target.getRole())) {
            throw new ApiException("Admins can remove ordinary members only");
        }
        memberRepository.delete(target);
    }

    private GroupMember requireTargetMember(Integer memberId) {
        GroupMember target = memberId == null ? null : memberRepository.findGroupMemberById(memberId);
        if (target == null) {
            throw new ApiException("Group member not found");
        }
        return target;
    }

    private GroupMemberDtoOut createMemberResponse(GroupMember member) {
        boolean paused = Boolean.TRUE.equals(member.getLocationSharingPaused()) && (member.getLocationSharingPausedUntil() == null || member.getLocationSharingPausedUntil().isAfter(validationService.getCurrentTime()));
        return new GroupMemberDtoOut(member.getId(), member.getUser().getId(), member.getUser().getName(), member.getRole(), paused, validationService.convertForResponse(paused ? member.getLocationSharingPausedUntil() : null), validationService.convertForResponse(member.getJoinedAt()));
    }
}
