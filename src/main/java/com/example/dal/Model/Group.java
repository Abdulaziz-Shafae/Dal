package com.example.dal.Model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;

import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "groups")
public class Group {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @NotBlank(message = "Group name is required")
    @Size(max = 100, message = "Group name must not exceed 100 characters")
    @Column(nullable = false, length = 100)
    private String name;

    @NotBlank(message = "Join code is required")
    @Size(min = 5, max = 5, message = "Join code must be exactly 5 characters")
    @Pattern(regexp = "[A-Z0-9]{5}", message = "Join code must contain 5 uppercase letters or numbers")
    @Check(constraints = "CHAR_LENGTH(join_code) = 5")
    @Column(name = "join_code", nullable = false, unique = true, length = 5)
    private String joinCode;

    @NotNull(message = "Group creator is required")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    @JsonIgnore
    private User createdBy;

    @NotBlank(message = "Group status is required")
    @Pattern(regexp = "ACTIVE|PAUSED|CLOSED", message = "Status must be ACTIVE, PAUSED, or CLOSED")
    @Check(constraints = "status IN ('ACTIVE', 'PAUSED', 'CLOSED')")
    @Column(nullable = false, length = 6)
    private String status = "ACTIVE";

    @NotBlank(message = "Join mode is required")
    @Pattern(regexp = "DIRECT|APPROVAL", message = "Join mode must be DIRECT or APPROVAL")
    @Check(constraints = "join_mode IN ('DIRECT', 'APPROVAL')")
    @Column(name = "join_mode", nullable = false, length = 8)
    private String joinMode = "DIRECT";

    @Column(name = "paused_until")
    private LocalDateTime pausedUntil;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "group")
    @JsonIgnore
    private Set<GroupMember> members = new HashSet<>();

    @OneToMany(mappedBy = "group")
    @JsonIgnore
    private Set<GroupJoinRequest> joinRequests = new HashSet<>();

    @OneToOne(mappedBy = "group", fetch = FetchType.LAZY)
    @JsonIgnore
    private MeetingPoint meetingPoint;

    @PrePersist
    public void initializeCreatedAt() {
        createdAt = LocalDateTime.now(ZoneOffset.UTC);
    }

}
