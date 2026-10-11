package com.example.dal.Model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.*;
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
@Table(name = "location_sharing_settings")
public class LocationSharingSettings {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @NotNull(message = "User is required")
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    @JsonIgnore
    private User user;

    @NotBlank(message = "Sharing mode is required")
    @Pattern(regexp = "SCHEDULED|WHILE_USING|ALWAYS", message = "Sharing mode must be SCHEDULED, WHILE_USING, or ALWAYS")
    @Check(constraints = "sharing_mode IN ('SCHEDULED', 'WHILE_USING', 'ALWAYS')")
    @Column(name = "sharing_mode", nullable = false, length = 11)
    private String sharingMode = "WHILE_USING";

    @Column(name = "start_time")
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @NotNull(message = "Paused state is required")
    @Column(name = "is_paused", nullable = false)
    private Boolean isPaused = false;

    @Column(name = "paused_until")
    private LocalDateTime pausedUntil;

    @NotNull(message = "Update interval is required")
    @Min(value = 1, message = "Update interval must be at least 1 second")
    @Check(constraints = "update_interval_seconds >= 1")
    @Column(name = "update_interval_seconds", nullable = false)
    private Integer updateIntervalSeconds = 5;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    @PreUpdate
    public void updateModificationTime() {
        updatedAt = LocalDateTime.now(ZoneOffset.UTC);
    }
}
