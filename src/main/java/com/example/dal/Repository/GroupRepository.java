package com.example.dal.Repository;

import com.example.dal.Model.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface GroupRepository extends JpaRepository<Group, Integer> {

    Group findGroupById(Integer id);

    Group findGroupByJoinCode(String joinCode);

    boolean existsByJoinCode(String joinCode);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select g from Group g where g.id = :id")
    Group findGroupForUpdate(@Param("id") Integer id);
}
