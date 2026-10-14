package com.example.dal.Model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.Check;

import java.time.LocalDateTime;
import java.time.ZoneOffset;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "group_members", uniqueConstraints = @UniqueConstraint(name = "uk_group_members_user_group", columnNames = {"user_id", "group_id"}))
public class GroupMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @NotNull(message = "User is required")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @NotNull(message = "Group is required")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "group_id", nullable = false)
    @JsonIgnore
    private Group group;

    @NotBlank(message = "Member role is required")
    @Pattern(regexp = "OWNER|ADMIN|MEMBER", message = "Role must be OWNER, ADMIN, or MEMBER")
    @Check(constraints = "role IN ('OWNER', 'ADMIN', 'MEMBER')")
    @Column(nullable = false, length = 6)
    private String role = "MEMBER";

    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    @NotNull(message = "Location sharing paused state is required")
    @Column(name = "location_sharing_paused", nullable = false)
    private Boolean locationSharingPaused = false;

    @Column(name = "location_sharing_paused_until")
    private LocalDateTime locationSharingPausedUntil;

    @Column(name = "locations_valid_from")
    private LocalDateTime locationsValidFrom;

    @PrePersist
    public void initializeJoinedAt() {
        joinedAt = LocalDateTime.now(ZoneOffset.UTC);
    }
}
