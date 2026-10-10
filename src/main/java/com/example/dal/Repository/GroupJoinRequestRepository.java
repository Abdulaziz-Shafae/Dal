package com.example.dal.Repository;

import com.example.dal.Model.GroupJoinRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupJoinRequestRepository extends JpaRepository<GroupJoinRequest, Integer> {

    GroupJoinRequest findGroupJoinRequestById(Integer id);

    List<GroupJoinRequest> findAllByGroup_IdAndStatus(Integer groupId, String status);

    boolean existsByUser_IdAndGroup_IdAndStatus(Integer userId, Integer groupId, String status);
}
