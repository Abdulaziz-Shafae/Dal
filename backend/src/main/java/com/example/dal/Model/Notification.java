package com.example.dal.Model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
import lombok.*;
import org.hibernate.annotations.Check;
import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "notifications", indexes = @Index(name = "idx_notification_receiver_created", columnList = "receiver_id, created_at"))
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    @JsonIgnore
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "sender_id", nullable = false)
    @JsonIgnore
    private User sender;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "receiver_id", nullable = false)
    @JsonIgnore
    private User receiver;

    @NotBlank
    @Pattern(regexp = "NUDGE|MESSAGE|ARRIVED")
    @Check(constraints = "type IN ('NUDGE', 'MESSAGE', 'ARRIVED')")
    @Column(nullable = false, length = 7)
    private String type;

    @NotBlank
    @Size(max = 250)
    @Column(nullable = false, length = 250)
    private String content;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "read_at")
    private LocalDateTime readAt;

    @PrePersist
    public void initializeCreatedAt() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}
