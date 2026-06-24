package com.smartsejong.api.domain.enrollment.entity;

import com.smartsejong.api.common.entity.BaseTimeEntity;
import com.smartsejong.api.domain.course.entity.Section;
import com.smartsejong.api.domain.user.entity.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 수강 등록 엔티티: 학생이 수강 중인 과목(Section)을 연결합니다.
 * eCampus에서 가져온 과목과 DB의 Section을 매칭하여 저장합니다.
 */
@Entity
@Table(name = "enrollments",
       uniqueConstraints = @UniqueConstraint(columnNames = {"user_id", "section_id"}))
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Enrollment extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "section_id", nullable = false)
    private Section section;

    @Column(nullable = false)
    private String ecampusCourseId; // eCampus 강의 ID

    @Column(nullable = false)
    private String semester; // 학기 (예: "2026-1")

    @Builder
    public Enrollment(User user, Section section, String ecampusCourseId, String semester) {
        this.user = user;
        this.section = section;
        this.ecampusCourseId = ecampusCourseId;
        this.semester = semester;
    }
}
