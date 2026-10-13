package com.example.dal.Model;

import jakarta.persistence.*;
import lombok.*;

@Entity @Getter @Setter @NoArgsConstructor
@Table(name="group_message_reads",uniqueConstraints=@UniqueConstraint(name="uk_group_message_read_member",columnNames={"group_id","user_id"}))
public class GroupMessageRead {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Integer id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="group_id",nullable=false) private Group group;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="user_id",nullable=false) private User user;
    @Column(name="last_message_id",nullable=false) private Integer lastMessageId=0;
}
