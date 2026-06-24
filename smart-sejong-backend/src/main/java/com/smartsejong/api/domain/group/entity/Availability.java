package com.smartsejong.api.domain.group.entity;

import com.smartsejong.api.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "availabilities",
        uniqueConstraints = @UniqueConstraint(columnNames = {"group_id", "user_id", "day_of_week", "slot"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Availability {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "group_id", nullable = false)
    private Group group;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // "MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"
    @Column(name = "day_of_week", nullable = false, length = 3)
    private String dayOfWeek;

    // 0-based 30-min slot index from 09:00. e.g. 0=09:00, 1=09:30, ...
    @Column(nullable = false)
    private int slot;

    @Builder
    public Availability(Group group, User user, String dayOfWeek, int slot) {
        this.group = group;
        this.user = user;
        this.dayOfWeek = dayOfWeek;
        this.slot = slot;
    }
}
