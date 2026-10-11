package com.example.dal.Repository;

import com.example.dal.Model.ReunionEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ReunionEventRepository extends JpaRepository<ReunionEvent, Integer> {

    ReunionEvent findFirstByUser_IdAndTargetUser_IdAndGroup_IdOrderByArrivedAtDescIdDesc(Integer userId, Integer targetUserId, Integer groupId);
}
