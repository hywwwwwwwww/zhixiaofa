-- ============================================================================
--  迁移脚本：新增 email_verify_code 邮箱验证码表（找回密码功能）
--  日期：2026-09-23
--  目的：让登录页的「忘记密码」链路能够工作：
--          · POST /api/auth/forgot-password   发验证码到邮箱
--          · POST /api/auth/reset-password    凭验证码设新密码
--        以及 UserService#sendPasswordResetCode / #resetPasswordByCode。
--
--  说明：
--   1) 本迁移是**增量**的：只建一张新表，不碰任何既有表与数据。
--      用的是 CREATE TABLE IF NOT EXISTS（不是 schema.sql 里的 DROP + CREATE），
--      以免重复执行时把已发出的验证码清掉。
--   2) 不需要回填存量数据：这张表只由找回密码流程写入。
--   3) sys_user 侧**没有**任何结构变更 —— email 列与 uk_user_email 唯一索引本来就有，
--      找回密码直接按邮箱定位账号。
--
--  执行：mysql -u root -p zhixiaofa < sql/migration-20260923-email-verify.sql
-- ============================================================================

CREATE TABLE IF NOT EXISTS `email_verify_code` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    `email`      VARCHAR(100) NOT NULL                COMMENT '目标邮箱',
    `scene`      VARCHAR(30)  NOT NULL DEFAULT 'RESET_PASSWORD' COMMENT '业务场景：RESET_PASSWORD=找回密码',
    `code_hash`  CHAR(64)     NOT NULL                COMMENT '验证码摘要(SHA-256(salt+明文))',
    `salt`       CHAR(32)     NOT NULL                COMMENT '验证码盐值(随机16字节的hex)',
    `expire_at`  DATETIME     NOT NULL                COMMENT '过期时间',
    `used`       TINYINT      NOT NULL DEFAULT 0      COMMENT '是否已作废：1=已使用或已达错误上限',
    `attempts`   INT          NOT NULL DEFAULT 0      COMMENT '校验错误次数',
    `client_ip`  VARCHAR(64)      NULL                COMMENT '发起请求的客户端IP，用于按IP限流',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_evc_email_scene_created` (`email`, `scene`, `created_at`),
    KEY `idx_evc_ip_created`          (`client_ip`, `created_at`),
    KEY `idx_evc_expire`              (`expire_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮箱验证码表';

-- ============================================================================
--  回滚（如需撤销）
--    DROP TABLE IF EXISTS `email_verify_code`;
--  （回滚只丢历史验证码，不影响任何业务数据；找回密码功能随即不可用）
-- ============================================================================
