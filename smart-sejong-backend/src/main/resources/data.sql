-- 교수 계정 초기 데이터
-- 이미 존재하면 무시
MERGE INTO users (student_id, full_name, major, role, created_at, updated_at) KEY(student_id)
VALUES ('PROF001', '김교수', '컴퓨터공학과', 'PROFESSOR', NOW(), NOW());

MERGE INTO users (student_id, full_name, major, role, created_at, updated_at) KEY(student_id)
VALUES ('PROF002', '이교수', '소프트웨어학과', 'PROFESSOR', NOW(), NOW());

MERGE INTO users (student_id, full_name, major, role, created_at, updated_at) KEY(student_id)
VALUES ('PROF003', '박교수', '인공지능학과', 'PROFESSOR', NOW(), NOW());
