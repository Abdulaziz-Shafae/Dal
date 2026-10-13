package com.example.dal.Repository;

import com.example.dal.Model.GroupMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.domain.*;

public interface GroupMessageRepository extends JpaRepository<GroupMessage,Integer> {
    GroupMessage findBySender_IdAndClientMessageId(Integer senderId,String clientMessageId);
    Page<GroupMessage> findAllByGroup_Id(Integer groupId,Pageable pageable);
    long countByGroup_IdAndSender_IdNotAndIdGreaterThan(Integer groupId,Integer senderId,Integer id);
}
