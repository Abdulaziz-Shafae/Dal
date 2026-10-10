package com.example.dal.Repository;

import com.example.dal.Model.GroupMember;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface GroupMemberRepository extends JpaRepository<GroupMember, Integer> {

    GroupMember findGroupMemberById(Integer id);

    GroupMember findByUser_IdAndGroup_Id(Integer userId, Integer groupId);

    boolean existsByUser_IdAndGroup_Id(Integer userId, Integer groupId);

    List<GroupMember> findAllByGroup_Id(Integer groupId);

    List<GroupMember> findAllByUser_Id(Integer userId);
}
