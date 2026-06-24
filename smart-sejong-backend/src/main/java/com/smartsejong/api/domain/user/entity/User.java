package com.smartsejong.api.domain.user.entity;

import com.smartsejong.api.common.entity.BaseTimeEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "users")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class User extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String studentId;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false)
    private String major;

    @Column
    private String grade;

    @Builder
    public User(String studentId, String fullName, String major, String grade) {
        this.studentId = studentId;
        this.fullName = fullName;
        this.major = major;
        this.grade = grade;
    }

    public void updateInfo(String fullName, String major) {
        updateInfo(fullName, major, this.grade);
    }

    public void updateInfo(String fullName, String major, String grade) {
        this.fullName = fullName;
        this.major = major;
        this.grade = grade;
    }
}
