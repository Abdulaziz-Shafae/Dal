package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.Model.Group;
import com.example.dal.Model.GroupMember;
import com.example.dal.Model.User;
import com.example.dal.Repository.*;
import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class GroupAccessService {

    private final EntityManager entityManager;
    private final UserRepository userRepository;
    private final GroupRepository groupRepository;
    private final GroupMemberRepository groupMemberRepository;

    public User requireUser(Integer userId) {
        if (userId == null) {
            throw new ApiException("Please log in first");
        }
        User user = userRepository.findUserById(userId);
        if (user == null) {
            throw new ApiException("User not found");
        }
        return user;
    }

    // Called inside a transaction; locks user workflows such as reset and message deduplication.
    public User requireUserForUpdate(Integer userId) {
        requireUser(userId);
        User user = userRepository.findUserForUpdate(userId);
        if (user == null) {
            throw new ApiException("User not found");
        }
        entityManager.refresh(user);
        return user;
    }

    public Group requireGroup(Integer groupId) {
        Group group = groupId == null ? null : groupRepository.findGroupById(groupId);
        if (group == null) {
            throw new ApiException("Group not found");
        }
        return group;
    }

    // Group mutations share this lock so membership, ownership and requests stay consistent.
    public Group requireGroupForUpdate(Integer groupId) {
        Group group = groupId == null ? null : groupRepository.findGroupForUpdate(groupId);
        if (group == null) {
            throw new ApiException("Group not found");
        }
        entityManager.refresh(group);
        return group;
    }

    public GroupMember requireMember(Integer userId, Integer groupId) {
        requireUser(userId);
        requireGroup(groupId);
        GroupMember member = groupMemberRepository.findByUser_IdAndGroup_Id(userId, groupId);
        if (member == null) {
            throw new ApiException("You are not a member of this group");
        }
        return member;
    }

    public GroupMember requireManager(Integer userId, Integer groupId) {
        GroupMember member = requireMember(userId, groupId);
        if (!"OWNER".equals(member.getRole()) && !"ADMIN".equals(member.getRole())) {
            throw new ApiException("Only the group owner or an admin can perform this action");
        }
        return member;
    }

    public GroupMember requireOwner(Integer userId, Integer groupId) {
        GroupMember member = requireMember(userId, groupId);
        if (!"OWNER".equals(member.getRole())) {
            throw new ApiException("Only the group owner can perform this action");
        }
        return member;
    }

    public void requireOpenGroup(Group group) {
        if ("CLOSED".equals(group.getStatus())) {
            throw new ApiException("This group is closed");
        }
    }
}
