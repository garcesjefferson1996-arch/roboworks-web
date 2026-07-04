-- ============================================================
-- VIRTUS - Esquema de base de datos (VIGENTE - MySQL)
-- Se evaluo migrar a Firebase/Firestore y se descarto: el dominio
-- es relacional (instituciones, clases, inscripciones, materiales)
-- y se necesitan reportes reales por institucion, algo que
-- Firestore no resuelve bien sin denormalizar todo a mano.
-- Este es el esquema que efectivamente usa el backend.
-- Basado en el modelo probado de RoboWorks, con mejoras para
-- soportar multiples instituciones (tenants), rol de docente,
-- y rendimiento con miles de estudiantes.
-- ============================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- INSTITUCIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,
    contact_email VARCHAR(150),
    contact_phone VARCHAR(30),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- USUARIOS (super_admin, academy_admin, teacher, student)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    role ENUM('super_admin','academy_admin','teacher','student') NOT NULL,
    profile_photo VARCHAR(500),
    temporary_password TINYINT(1) NOT NULL DEFAULT 0,
    invitation_code VARCHAR(50),
    parent_phone VARCHAR(30),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    failed_login_attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMP NULL,
    totp_secret VARCHAR(255) NULL,
    totp_enabled TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    INDEX idx_users_tenant (tenant_id),
    INDEX idx_users_role (role),
    INDEX idx_users_tenant_role (tenant_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DELIMITER //
CREATE PROCEDURE IF NOT EXISTS virtus_add_column_if_missing(
    IN p_table VARCHAR(64), IN p_column VARCHAR(64), IN p_definition VARCHAR(255)
)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column
    ) THEN
        SET @ddl = CONCAT('ALTER TABLE `', p_table, '` ADD COLUMN ', p_definition);
        PREPARE stmt FROM @ddl;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END //
DELIMITER ;

CALL virtus_add_column_if_missing('users', 'failed_login_attempts', 'failed_login_attempts INT NOT NULL DEFAULT 0');
CALL virtus_add_column_if_missing('users', 'locked_until', 'locked_until TIMESTAMP NULL');
CALL virtus_add_column_if_missing('users', 'totp_secret', 'totp_secret VARCHAR(255) NULL');
CALL virtus_add_column_if_missing('users', 'totp_enabled', 'totp_enabled TINYINT(1) NOT NULL DEFAULT 0');

-- ------------------------------------------------------------
-- PROGRAMAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    color VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS codeworks_courses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    program_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    icon VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_courses_program FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE,
    INDEX idx_courses_program (program_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- GRADOS ESCOLARES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_order INT NOT NULL DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS grade_lessons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    grade_id INT NOT NULL,
    lesson_number INT NOT NULL,
    trimester TINYINT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    lesson_plan LONGTEXT,
    lesson_plan_file_url VARCHAR(500),
    lesson_plan_file_name VARCHAR(255),
    video_link VARCHAR(500),
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_gl_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE,
    UNIQUE KEY uq_grade_lesson_number (grade_id, lesson_number),
    INDEX idx_gl_grade (grade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lesson_resources (
    id INT AUTO_INCREMENT PRIMARY KEY,
    lesson_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    resource_type ENUM('file','link','image') NOT NULL,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    external_link VARCHAR(500),
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lr_lesson FOREIGN KEY (lesson_id) REFERENCES grade_lessons(id) ON DELETE CASCADE,
    INDEX idx_lr_lesson (lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- DOCENTE <-> GRADO (asignacion masiva: el docente ve automaticamente
-- todas las clases de su institucion que pertenezcan a estos grados,
-- ademas de cualquier clase asignada individualmente via classes.teacher_id)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teacher_grades (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    teacher_id INT NOT NULL,
    grade_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tg_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_tg_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_tg_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE CASCADE,
    UNIQUE KEY uq_teacher_grade (teacher_id, grade_id),
    INDEX idx_tg_teacher (teacher_id),
    INDEX idx_tg_grade (grade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- CLASES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NOT NULL,
    program_id INT NULL,
    codeworks_course_id INT NULL,
    grade_id INT NULL,
    name VARCHAR(150) NOT NULL,
    teacher_id INT NULL,
    zoom_link VARCHAR(500),
    schedule_day ENUM('monday','tuesday','wednesday','thursday','friday','saturday','sunday'),
    schedule_time TIME,
    description TEXT,
    max_students INT NOT NULL DEFAULT 25,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_classes_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_classes_program FOREIGN KEY (program_id) REFERENCES programs(id),
    CONSTRAINT fk_classes_course FOREIGN KEY (codeworks_course_id) REFERENCES codeworks_courses(id) ON DELETE SET NULL,
    CONSTRAINT fk_classes_teacher FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_classes_grade FOREIGN KEY (grade_id) REFERENCES grades(id) ON DELETE SET NULL,
    INDEX idx_classes_tenant (tenant_id),
    INDEX idx_classes_teacher (teacher_id),
    INDEX idx_classes_program (program_id),
    INDEX idx_classes_grade (grade_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CALL virtus_add_column_if_missing('classes', 'grade_id', 'grade_id INT NULL');
ALTER TABLE classes MODIFY COLUMN program_id INT NULL;
CALL virtus_add_column_if_missing('grade_lessons', 'lesson_plan', 'lesson_plan LONGTEXT NULL');
CALL virtus_add_column_if_missing('grade_lessons', 'lesson_plan_file_url', 'lesson_plan_file_url VARCHAR(500) NULL');
CALL virtus_add_column_if_missing('grade_lessons', 'lesson_plan_file_name', 'lesson_plan_file_name VARCHAR(255) NULL');
CALL virtus_add_column_if_missing('grade_lessons', 'trimester', 'trimester TINYINT NULL');

-- ------------------------------------------------------------
-- INSCRIPCIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_students (
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (class_id, student_id),
    CONSTRAINT fk_cs_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_cs_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_cs_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- CATEGORIAS DE MATERIAL
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS material_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#667eea',
    display_order INT NOT NULL DEFAULT 0,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mc_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    INDEX idx_mc_class (class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- MATERIALES DE CLASE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS class_materials (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    category_id INT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    material_type ENUM('file','link','text') NOT NULL,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    file_size INT,
    external_link VARCHAR(500),
    uploaded_by INT NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    display_order INT NOT NULL DEFAULT 0,
    CONSTRAINT fk_cm_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_cm_category FOREIGN KEY (category_id) REFERENCES material_categories(id) ON DELETE SET NULL,
    CONSTRAINT fk_cm_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id),
    INDEX idx_cm_class (class_id),
    INDEX idx_cm_category (category_id),
    INDEX idx_cm_class_active (class_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TAREAS (asignadas por el docente a una clase)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    due_date DATETIME NULL,
    max_score DECIMAL(5,2) NOT NULL DEFAULT 10,
    created_by INT NOT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_creator FOREIGN KEY (created_by) REFERENCES users(id),
    INDEX idx_task_class (class_id),
    INDEX idx_task_class_active (class_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- ENTREGAS (una por estudiante y tarea; re-entregar sobreescribe hasta calificar)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    student_id INT NOT NULL,
    submission_type ENUM('file','link','text') NOT NULL,
    file_url VARCHAR(500),
    file_name VARCHAR(255),
    external_link VARCHAR(500),
    text_content TEXT,
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    score DECIMAL(5,2) NULL,
    teacher_feedback TEXT,
    graded_by INT NULL,
    graded_at TIMESTAMP NULL,
    CONSTRAINT fk_sub_task FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_sub_grader FOREIGN KEY (graded_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_task_student (task_id, student_id),
    INDEX idx_sub_task (task_id),
    INDEX idx_sub_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- ASISTENCIA (una fila por estudiante, clase y fecha)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    class_id INT NOT NULL,
    student_id INT NOT NULL,
    attendance_date DATE NOT NULL,
    status ENUM('present','absent','late','excused') NOT NULL DEFAULT 'present',
    notes VARCHAR(255),
    recorded_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_att_class FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_student FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_att_recorder FOREIGN KEY (recorded_by) REFERENCES users(id),
    UNIQUE KEY uq_att_class_student_date (class_id, student_id, attendance_date),
    INDEX idx_att_class_date (class_id, attendance_date),
    INDEX idx_att_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- NOTIFICACIONES (campanita in-app: tarea nueva, entrega calificada,
-- entrega recibida)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    message VARCHAR(255) NOT NULL,
    related_type VARCHAR(50) NULL,
    related_id INT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notif_user_read (user_id, is_read),
    INDEX idx_notif_user_created (user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- AUDITORIA
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tenant_id INT NULL,
    actor_id INT NULL,
    actor_role VARCHAR(30),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id VARCHAR(50),
    metadata JSON,
    ip_address VARCHAR(64),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_audit_tenant (tenant_id),
    INDEX idx_audit_actor (actor_id),
    INDEX idx_audit_action (action),
    INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP PROCEDURE IF EXISTS virtus_add_column_if_missing;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Datos semilla minimos para arrancar
-- ------------------------------------------------------------
INSERT IGNORE INTO tenants (id, name, slug, is_active) VALUES (1, 'Virtus Demo', 'virtus-demo', 1);

INSERT IGNORE INTO programs (id, name, description, icon, color) VALUES
    (1, 'RoboStart', 'Programa introductorio de robotica', 'robot', '#4f46e5'),
    (2, 'CodeWorks', 'Programa de programacion por cursos', 'code', '#059669');

INSERT IGNORE INTO grades (id, name, display_order, description) VALUES
    (1, 'Preescolar', 1, 'Educacion inicial'),
    (2, '1ro de Basica', 2, NULL), (3, '2do de Basica', 3, NULL), (4, '3ro de Basica', 4, NULL),
    (5, '4to de Basica', 5, NULL), (6, '5to de Basica', 6, NULL), (7, '6to de Basica', 7, NULL),
    (8, '7mo de Basica', 8, NULL), (9, '8vo de Basica', 9, NULL), (10, '9no de Basica', 10, NULL),
    (11, '10mo de Basica', 11, NULL),
    (12, '1ro de Bachillerato', 12, NULL), (13, '2do de Bachillerato', 13, NULL), (14, '3ro de Bachillerato', 14, NULL);

-- Nota: crea el primer usuario super_admin manualmente con el script
-- create-admin.js (hashea la contrasena con bcrypt, no insertar en texto plano).
