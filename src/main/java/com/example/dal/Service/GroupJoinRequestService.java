package com.example.dal.Service;

import com.example.dal.Api.ApiException;
import com.example.dal.DtoOut.GroupJoinRequestDtoOut;
import com.example.dal.Model.*;
import com.example.dal.Repository.*;
import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;

@Service
@RequiredArgsConstructor
public class GroupJoinRequestService {

    private final EntityManager entityManager;

    private final GroupJoinRequestRepository requestRepository;
    private final GroupMemberRepository memberRepository;
    private final GroupAccessService accessService;
    private final InputValidationService validationService;

    @Transactional(readOnly = true)
    public List<GroupJoinRequestDtoOut> getMyJoinRequests(Integer userId) {
        accessService.requireUser(userId);
        return requestRepository.findAllByUser_IdOrderByRequestedAtDesc(userId).stream().map(this::createRequestResponse).toList();
    }

    @Transactional(readOnly = true)
    public List<GroupJoinRequestDtoOut> getGroupJoinRequests(Integer userId, Integer groupId, String status) {
        accessService.requireManager(userId, groupId);
        if (status != null && !status.matches("PENDING|APPROVED|REJECTED")) {
            throw new ApiException("Status must be PENDING, APPROVED, or REJECTED");
        }
        var requests = status == null ? requestRepository.findAllByGroup_IdOrderByRequestedAtDesc(groupId) : requestRepository.findAllByGroup_IdAndStatus(groupId, status);
        return requests.stream().map(this::createRequestResponse).toList();
    }

    @Transactional
    public GroupJoinRequestDtoOut approveJoinRequest(Integer userId, Integer requestId) {
        GroupJoinRequest request = requireRequest(requestId);
        Group group = accessService.requireGroupForUpdate(request.getGroup().getId());
        entityManager.refresh(request);
        accessService.requireManager(userId, group.getId());
        accessService.requireOpenGroup(group);
        requirePendingRequest(request);
        if (memberRepository.existsByUser_IdAndGroup_Id(request.getUser().getId(), group.getId())) {
            throw new ApiException("This user is already a member of the group");
        }
        GroupMember member = new GroupMember();
        member.setGroup(group);
        member.setUser(request.getUser());
        memberRepository.saveAndFlush(member);
        reviewRequest(request, userId, "APPROVED");
        return createRequestResponse(request);
    }

    @Transactional
    public GroupJoinRequestDtoOut rejectJoinRequest(Integer userId, Integer requestId) {
        GroupJoinRequest request = requireRequest(requestId);
        Group group = accessService.requireGroupForUpdate(request.getGroup().getId());
        entityManager.refresh(request);
        accessService.requireManager(userId, group.getId());
        accessService.requireOpenGroup(group);
        requirePendingRequest(request);
        reviewRequest(request, userId, "REJECTED");
        return createRequestResponse(request);
    }

    @Transactional
    public void cancelJoinRequest(Integer userId, Integer requestId) {
        accessService.requireUser(userId);
        GroupJoinRequest request = requireRequest(requestId);
        accessService.requireGroupForUpdate(request.getGroup().getId());
        entityManager.refresh(request);
        if (!request.getUser().getId().equals(userId)) {
            throw new ApiException("You can cancel your own request only");
        }
        requirePendingRequest(request);
        requestRepository.delete(request);
    }

    private GroupJoinRequest requireRequest(Integer requestId) {
        GroupJoinRequest request = requestId == null ? null : requestRepository.findGroupJoinRequestById(requestId);
        if (request == null) {
            throw new ApiException("Join request not found");
        }
        return request;
    }

    private void requirePendingRequest(GroupJoinRequest request) {
        if (!"PENDING".equals(request.getStatus())) {
            throw new ApiException("Only pending requests can be reviewed or cancelled");
        }
    }

    private void reviewRequest(GroupJoinRequest request, Integer reviewerId, String status) {
        request.setStatus(status);
        request.setReviewedBy(accessService.requireUser(reviewerId));
        request.setReviewedAt(validationService.getCurrentTime());
        requestRepository.save(request);
    }

    private GroupJoinRequestDtoOut createRequestResponse(GroupJoinRequest request) {
        return new GroupJoinRequestDtoOut(request.getId(), request.getGroup().getId(), request.getGroup().getName(), request.getUser().getId(), request.getUser().getName(), request.getStatus(), validationService.convertForResponse(request.getRequestedAt()), validationService.convertForResponse(request.getReviewedAt()), request.getReviewedBy() == null ? null : request.getReviewedBy().getId());
    }
}
