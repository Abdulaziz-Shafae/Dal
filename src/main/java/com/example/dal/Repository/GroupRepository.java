package com.example.dal.Repository;

import com.example.dal.Model.Group;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface GroupRepository extends JpaRepository<Group, Integer> {

    Group findGroupById(Integer id);

    Group findGroupByJoinCode(String joinCode);

    boolean existsByJoinCode(String joinCode);
}
