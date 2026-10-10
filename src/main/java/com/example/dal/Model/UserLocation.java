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

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Entity
@Table(name = "user_locations", indexes = @Index(name = "idx_user_locations_user_recorded", columnList = "user_id, recorded_at"))
public class UserLocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Integer id;

    @NotNull(message = "User is required")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    @JsonIgnore
    private User user;

    @NotNull(message = "Latitude is required")
    @DecimalMin(value = "-90", message = "Latitude must be at least -90")
    @DecimalMax(value = "90", message = "Latitude must not exceed 90")
    @Check(constraints = "latitude BETWEEN -90 AND 90")
    @Column(nullable = false)
    private Double latitude;

    @NotNull(message = "Longitude is required")
    @DecimalMin(value = "-180", message = "Longitude must be at least -180")
    @DecimalMax(value = "180", message = "Longitude must not exceed 180")
    @Check(constraints = "longitude BETWEEN -180 AND 180")
    @Column(nullable = false)
    private Double longitude;

    @PositiveOrZero(message = "Accuracy must not be negative")
    @Check(constraints = "accuracy >= 0")
    @Column
    private Double accuracy;

    @NotNull(message = "Recorded time is required")
    @Column(name = "recorded_at", nullable = false)
    private LocalDateTime recordedAt;
}
