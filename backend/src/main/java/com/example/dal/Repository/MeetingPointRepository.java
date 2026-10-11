package com.example.dal.Repository;

import com.example.dal.Model.MeetingPoint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MeetingPointRepository extends JpaRepository<MeetingPoint, Integer> {

    MeetingPoint findMeetingPointById(Integer id);

    MeetingPoint findByGroup_Id(Integer groupId);
}
