package com.example.dal.Repository;

import com.example.dal.Model.UserLocation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;


@Repository
public interface UserLocationRepository extends JpaRepository<UserLocation, Integer> {

    UserLocation findUserLocationById(Integer id);

    UserLocation findFirstByUser_IdOrderByRecordedAtDescIdDesc(Integer userId);

    long deleteByUser_Id(Integer userId);
}
