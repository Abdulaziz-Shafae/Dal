package com.example.dal.Repository;
import com.example.dal.Model.GroupMessageRead;
import org.springframework.data.jpa.repository.JpaRepository;
public interface GroupMessageReadRepository extends JpaRepository<GroupMessageRead,Integer> {
    GroupMessageRead findByGroup_IdAndUser_Id(Integer groupId,Integer userId);
}
