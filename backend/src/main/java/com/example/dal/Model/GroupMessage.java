package com.example.dal.Model;

import jakarta.persistence.*;
import lombok.*;
import java.time.*;

@Entity @Getter @Setter @NoArgsConstructor
@Table(name="group_messages",uniqueConstraints=@UniqueConstraint(name="uk_group_message_sender_client",columnNames={"sender_id","client_message_id"}),indexes=@Index(name="idx_group_message_group_id",columnList="group_id,id"))
public class GroupMessage {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Integer id;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="group_id",nullable=false) private Group group;
    @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="sender_id",nullable=false) private User sender;
    @Column(nullable=false,length=1000) private String content;
    @Column(name="client_message_id",nullable=false,length=64) private String clientMessageId;
    @Column(name="created_at",nullable=false,updatable=false) private LocalDateTime createdAt;
    @PrePersist void initialize() {createdAt=LocalDateTime.now(ZoneOffset.UTC);}
}
