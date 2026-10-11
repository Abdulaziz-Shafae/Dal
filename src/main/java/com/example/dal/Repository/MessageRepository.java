package com.example.dal.Repository;

import com.example.dal.Model.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message, Integer> {

    Message findMessageById(Integer id);

    Message findBySender_IdAndClientMessageId(Integer senderId, String clientMessageId);

    @Query("select m from Message m where m.group.id = :groupId and ((m.sender.id = :userId and m.receiver.id = :otherId) or (m.sender.id = :otherId and m.receiver.id = :userId))")
    Page<Message> findConversation(@Param("groupId") Integer groupId, @Param("userId") Integer userId, @Param("otherId") Integer otherId, Pageable pageable);
}
