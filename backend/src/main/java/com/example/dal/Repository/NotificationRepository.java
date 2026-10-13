package com.example.dal.Repository;

import com.example.dal.Model.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Integer> {
    long countByReceiver_IdAndReadAtIsNull(Integer receiverId);

    Notification findNotificationById(Integer id);

    Page<Notification> findAllByReceiver_Id(Integer receiverId, Pageable pageable);

    Notification findFirstBySender_IdAndReceiver_IdAndGroup_IdAndTypeOrderByCreatedAtDescIdDesc(Integer senderId, Integer receiverId, Integer groupId, String type);
}
