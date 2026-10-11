package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoIn.*;
import com.example.dal.DtoOut.*;
import com.example.dal.Model.*;
import com.example.dal.Repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class GroupService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;
    private final GroupJoinRequestRepository requestRepository;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;
    private final SecureRandom secureRandom = new SecureRandom();
    private static final String CODE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    @Transactional
    public GroupDtoOut createGroup(Integer userId, GroupDtoIn input) {
        validationService.validateInput(input);
        User user = accessService.requireUser(userId);
        Group group = new Group();
        group.setName(input.getName().trim());
        group.setJoinMode(input.getJoinMode());
        group.setJoinCode(generateUniqueJoinCode());
        group.setCreatedBy(user);
        groupRepository.saveAndFlush(group);
        GroupMember owner = new GroupMember();
        owner.setUser(user);
        owner.setGroup(group);
        owner.setRole("OWNER");
        memberRepository.saveAndFlush(owner);
        return createGroupResponse(group, owner.getRole());
    }

    @Transactional(readOnly = true)
    public List<GroupDtoOut> getMyGroups(Integer userId) {
        accessService.requireUser(userId);
        List<GroupDtoOut> result = new ArrayList<>();
        for (GroupMember member : memberRepository.findAllByUser_Id(userId)) {
            result.add(createGroupResponse(member.getGroup(), member.getRole()));
        }
        return result;
    }

    @Transactional(readOnly = true)
    public GroupDtoOut getGroupDetails(Integer userId, Integer groupId) {
        GroupMember member = accessService.requireMember(userId, groupId);
        return createGroupResponse(member.getGroup(), member.getRole());
    }

    @Transactional
    public GroupDtoOut updateGroup(Integer userId, Integer groupId, GroupDtoIn input) {
        validationService.validateInput(input);
        Group group = accessService.requireGroupForUpdate(groupId);
        GroupMember manager = accessService.requireManager(userId, groupId);
        accessService.requireOpenGroup(group);
        group.setName(input.getName().trim());
        group.setJoinMode(input.getJoinMode());
        groupRepository.save(group);
        return createGroupResponse(group, manager.getRole());
    }

    @Transactional
    public JoinGroupDtoOut joinGroup(Integer userId, JoinGroupDtoIn input) {
        validationService.validateInput(input);
        User user = accessService.requireUser(userId);
        String code = input.getJoinCode().toUpperCase(Locale.ROOT);
        Group candidate = groupRepository.findGroupByJoinCode(code);
        if (candidate == null) {
            throw new ApiException("Invalid group join code");
        }
        Group group = accessService.requireGroupForUpdate(candidate.getId());
        if (!code.equals(group.getJoinCode())) {
            throw new ApiException("This join code is no longer valid");
        }
        accessService.requireOpenGroup(group);
        if (memberRepository.existsByUser_IdAndGroup_Id(userId, group.getId())) {
            throw new ApiException("You are already a member of this group");
        }
        if (requestRepository.existsByUser_IdAndGroup_IdAndStatus(userId, group.getId(), "PENDING")) {
            throw new ApiException("You already have a pending request for this group");
        }
        if ("APPROVAL".equals(group.getJoinMode())) {
            GroupJoinRequest request = new GroupJoinRequest();
            request.setUser(user);
            request.setGroup(group);
            requestRepository.saveAndFlush(request);
            return new JoinGroupDtoOut(group.getId(), request.getId(), "PENDING", "Join request sent for approval");
        }
        GroupMember member = new GroupMember();
        member.setUser(user);
        member.setGroup(group);
        memberRepository.saveAndFlush(member);
        return new JoinGroupDtoOut(group.getId(), null, "JOINED", "Joined the group successfully");
    }

    @Transactional
    public GroupDtoOut pauseGroup(Integer userId, Integer groupId, PauseDtoIn input) {
        validationService.validateInput(input);
        Group group = accessService.requireGroupForUpdate(groupId);
        GroupMember manager = accessService.requireManager(userId, groupId);
        accessService.requireOpenGroup(group);
        group.setPausedUntil(validationService.validatePauseUntil(input.getPausedUntil()));
        group.setStatus("PAUSED");
        groupRepository.save(group);
        return createGroupResponse(group, manager.getRole());
    }

    @Transactional
    public GroupDtoOut resumeGroup(Integer userId, Integer groupId) {
        Group group = accessService.requireGroupForUpdate(groupId);
        GroupMember manager = accessService.requireManager(userId, groupId);
        accessService.requireOpenGroup(group);
        group.setStatus("ACTIVE");
        group.setPausedUntil(null);
        groupRepository.save(group);
        return createGroupResponse(group, manager.getRole());
    }

    @Transactional
    public void closeGroup(Integer userId, Integer groupId) {
        Group group = accessService.requireGroupForUpdate(groupId);
        accessService.requireOwner(userId, groupId);
        accessService.requireOpenGroup(group);
        group.setStatus("CLOSED");
        group.setPausedUntil(null);
        for (GroupJoinRequest request : requestRepository.findAllByGroup_IdAndStatus(groupId, "PENDING")) {
            request.setStatus("REJECTED");
            request.setReviewedAt(validationService.getCurrentTime());
            request.setReviewedBy(accessService.requireUser(userId));
        }
        groupRepository.save(group);
    }

    @Transactional
    public GroupDtoOut regenerateJoinCode(Integer userId, Integer groupId) {
        Group group = accessService.requireGroupForUpdate(groupId);
        GroupMember manager = accessService.requireManager(userId, groupId);
        accessService.requireOpenGroup(group);
        group.setJoinCode(generateUniqueJoinCode());
        groupRepository.saveAndFlush(group);
        return createGroupResponse(group, manager.getRole());
    }

    @Transactional
    public void transferGroupOwnership(Integer userId, Integer groupId, Integer memberId) {
        Group group = accessService.requireGroupForUpdate(groupId);
        GroupMember owner = accessService.requireOwner(userId, groupId);
        accessService.requireOpenGroup(group);
        GroupMember target = memberId == null ? null : memberRepository.findGroupMemberById(memberId);
        if (target == null || !target.getGroup().getId().equals(groupId)) {
            throw new ApiException("Target member does not belong to this group");
        }
        if (target.getId().equals(owner.getId())) {
            throw new ApiException("This member already owns the group");
        }
        owner.setRole("ADMIN");
        target.setRole("OWNER");
        memberRepository.save(owner);
        memberRepository.save(target);
        // createdBy stays the original creator; current ownership is stored in GroupMember.role.
    }

    private String generateUniqueJoinCode() {
        for (int attempt = 0; attempt < 100; attempt++) {
            StringBuilder code = new StringBuilder();
            for (int i = 0; i < 5; i++) {
                code.append(CODE_CHARACTERS.charAt(secureRandom.nextInt(CODE_CHARACTERS.length())));
            }
            if (!groupRepository.existsByJoinCode(code.toString())) {
                return code.toString();
            }
        }
        throw new ApiException("Unable to generate a join code. Please try again");
    }

    private GroupDtoOut createGroupResponse(Group group, String role) {
        String status = group.getStatus();
        if ("PAUSED".equals(status) && group.getPausedUntil() != null && !group.getPausedUntil().isAfter(validationService.getCurrentTime())) {
            status = "ACTIVE";
        }
        return new GroupDtoOut(group.getId(), group.getName(), group.getJoinCode(), status, group.getJoinMode(), group.getCreatedBy().getId(), role, memberRepository.countByGroup_Id(group.getId()), validationService.convertForResponse("PAUSED".equals(status) ? group.getPausedUntil() : null), validationService.convertForResponse(group.getCreatedAt()));
    }
}
