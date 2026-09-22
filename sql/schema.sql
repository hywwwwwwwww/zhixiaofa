-- ============================================================================
--  职小法 · 职场新人智能法律助手  数据库建库建表脚本 (DDL)
--  数据库：MySQL 8.0   字符集：utf8mb4   存储引擎：InnoDB
--  范式：所有表满足第三范式(3NF)
--  说明：本文件只建结构；测试数据见 data.sql
--  执行：mysql -u root -p < schema.sql
-- ============================================================================

DROP DATABASE IF EXISTS `zhixiaofa`;
CREATE DATABASE `zhixiaofa`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_general_ci;
USE `zhixiaofa`;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
-- 1. sys_user  系统用户表（前台用户与后台管理员共用，用 role 区分）
--    设计说明：role 只有 USER / ADMIN 两个取值，不单独拆表，
--              因为管理员没有独立于用户之外的属性，拆表会造成 1:1 冗余（违反 3NF）。
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `sys_user`;
CREATE TABLE `sys_user` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '用户主键',
    `username`      VARCHAR(50)  NOT NULL                COMMENT '登录名，唯一',
    `password`      CHAR(64)     NOT NULL                COMMENT '密码摘要(SHA-256(salt+明文))',
    `salt`          CHAR(32)     NOT NULL                COMMENT '密码盐值(随机16字节的hex)',
    `nickname`      VARCHAR(50)      NULL                COMMENT '昵称',
    `email`         VARCHAR(100)     NULL                COMMENT '邮箱，唯一',
    `phone`         VARCHAR(20)      NULL                COMMENT '手机号',
    `avatar`        VARCHAR(255)     NULL                COMMENT '头像URL',
    `role`          VARCHAR(20)  NOT NULL DEFAULT 'USER' COMMENT '角色：USER=普通用户, ADMIN=管理员',
    `status`        TINYINT      NOT NULL DEFAULT 1      COMMENT '状态：1=正常, 0=禁用',
    `city`          VARCHAR(50)      NULL                COMMENT '所在城市',
    `job_title`     VARCHAR(50)      NULL                COMMENT '岗位',
    `last_login_at` DATETIME         NULL                COMMENT '最近登录时间',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_user_username` (`username`),
    UNIQUE KEY `uk_user_email`    (`email`),
    KEY `idx_user_role_status` (`role`, `status`),
    KEY `idx_user_created_at`  (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- ---------------------------------------------------------------------------
-- 2. law_article  法律法规条文表
--    ngram 全文索引用于问答时的“法条关键词检索”，避免 LIKE '%kw%' 全表扫描。
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `law_article`;
CREATE TABLE `law_article` (
    `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '法条主键',
    `law_name`       VARCHAR(100) NOT NULL                COMMENT '法规名称，如《中华人民共和国劳动合同法》',
    `article_no`     VARCHAR(30)  NOT NULL                COMMENT '条号，如“第十条”',
    `seq`            INT              NULL                COMMENT '法律内序号（该法律的第几条，从 1 开始）',
    `category`       VARCHAR(30)  NOT NULL                COMMENT '分类：劳动合同/劳动报酬/工作时间与休息休假/社会保险/解除与终止/其他',
    `title`          VARCHAR(200)     NULL                COMMENT '条文标题（可为章节名）',
    `content`        TEXT             NULL                COMMENT '条文正文（自动同步时部分条文可能未命中正文，允许为空）',
    `keywords`       VARCHAR(255)     NULL                COMMENT '关键词(检索辅助)',
    `effective_date` DATE             NULL                COMMENT '生效日期',
    `source`         VARCHAR(50)  NOT NULL DEFAULT 'manual' COMMENT '来源：manual=手工录入 / flk_npc=国家法律法规数据库同步',
    `source_id`      VARCHAR(64)      NULL                COMMENT '来源侧唯一标识（国家法律法规数据库的 bbbs）',
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_law_name_no` (`law_name`, `article_no`),
    KEY `idx_law_category` (`category`),
    FULLTEXT KEY `ft_law_content` (`title`, `content`, `keywords`) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='法律法规条文表';

-- ---------------------------------------------------------------------------
-- 3. qa_record  智能法律问答记录表
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `qa_record`;
CREATE TABLE `qa_record` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT COMMENT '问答主键',
    `user_id`    BIGINT      NOT NULL                COMMENT '提问用户ID',
    `question`   TEXT        NOT NULL                COMMENT '用户问题',
    `answer`     TEXT            NULL                COMMENT '系统生成的回答',
    `category`   VARCHAR(30)     NULL                COMMENT '问题分类',
    `status`     TINYINT     NOT NULL DEFAULT 0      COMMENT '状态：0=待回答, 1=已回答',
    `like_count` INT         NOT NULL DEFAULT 0      COMMENT '点赞数',
    `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提问时间',
    `updated_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_qa_user_id`    (`user_id`),
    KEY `idx_qa_status`     (`status`),
    KEY `idx_qa_category`   (`category`),
    KEY `idx_qa_created_at` (`created_at`),
    CONSTRAINT `fk_qa_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='智能法律问答记录表';

-- ---------------------------------------------------------------------------
-- 4. qa_reference  问答↔法条 关联表（多对多桥表）
--    一条问答可引用多条法条，一条法条可被多条问答引用。
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `qa_reference`;
CREATE TABLE `qa_reference` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '主键',
    `qa_id`         BIGINT       NOT NULL                COMMENT '问答ID',
    `law_id`        BIGINT       NOT NULL                COMMENT '法条ID',
    `relevance`     DECIMAL(5,2) NOT NULL DEFAULT 1.00   COMMENT '相关度评分 0~1',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_qa_law` (`qa_id`, `law_id`),
    KEY `idx_ref_law_id` (`law_id`),
    CONSTRAINT `fk_ref_qa`  FOREIGN KEY (`qa_id`)  REFERENCES `qa_record`  (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_ref_law` FOREIGN KEY (`law_id`) REFERENCES `law_article` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='问答引用法条关联表';

-- ---------------------------------------------------------------------------
-- 5. court_case  AI小法庭案件推演记录表
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `court_case`;
CREATE TABLE `court_case` (
    `id`               BIGINT        NOT NULL AUTO_INCREMENT COMMENT '案件主键',
    `user_id`          BIGINT        NOT NULL                COMMENT '提交用户ID',
    `title`            VARCHAR(200)  NOT NULL                COMMENT '案件标题',
    `description`      TEXT          NOT NULL                COMMENT '案情描述',
    `case_type`        VARCHAR(30)       NULL                COMMENT '案件类型：拖欠工资/违法辞退/加班费/社保/其他',
    `win_probability`  DECIMAL(5,2)      NULL                COMMENT '胜诉概率(%)',
    `compensation_min` DECIMAL(12,2)     NULL                COMMENT '赔偿金额下限(元)',
    `compensation_max` DECIMAL(12,2)     NULL                COMMENT '赔偿金额上限(元)',
    `similar_count`    INT           NOT NULL DEFAULT 0      COMMENT '参考的类案数量',
    `result_summary`   TEXT              NULL                COMMENT '推演结论',
    `created_at`       DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '提交时间',
    PRIMARY KEY (`id`),
    KEY `idx_case_user_id`   (`user_id`),
    KEY `idx_case_type`      (`case_type`),
    KEY `idx_case_created_at`(`created_at`),
    CONSTRAINT `fk_case_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='AI小法庭案件推演表';

-- ---------------------------------------------------------------------------
-- 6. contract  合同表
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `contract`;
CREATE TABLE `contract` (
    `id`            BIGINT       NOT NULL AUTO_INCREMENT COMMENT '合同主键',
    `user_id`       BIGINT       NOT NULL                COMMENT '上传用户ID',
    `file_name`     VARCHAR(200) NOT NULL                COMMENT '合同文件名',
    `contract_type` VARCHAR(30)      NULL                COMMENT '合同类型：劳动合同/实习协议/竞业协议/其他',
    `party_a`       VARCHAR(100)     NULL                COMMENT '甲方',
    `party_b`       VARCHAR(100)     NULL                COMMENT '乙方',
    `sign_date`     DATE             NULL                COMMENT '签订日期',
    `content`       TEXT             NULL                COMMENT '合同正文',
    `risk_level`    VARCHAR(10)      NULL                COMMENT '整体风险等级：高/中/低',
    `risk_count`    INT          NOT NULL DEFAULT 0      COMMENT '风险点数量',
    `status`        TINYINT      NOT NULL DEFAULT 0      COMMENT '状态：0=待审查, 1=已审查',
    `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
    `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_contract_user_id` (`user_id`),
    KEY `idx_contract_status`  (`status`),
    KEY `idx_contract_created` (`created_at`),
    CONSTRAINT `fk_contract_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合同表';

-- ---------------------------------------------------------------------------
-- 7. contract_risk  合同风险点表（合同 1 : N 风险点）
--    写入时与 contract 在同一事务内，保证 risk_count 与明细一致。
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `contract_risk`;
CREATE TABLE `contract_risk` (
    `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '风险点主键',
    `contract_id`    BIGINT       NOT NULL                COMMENT '所属合同ID',
    `risk_level`     VARCHAR(10)  NOT NULL                COMMENT '风险等级：高/中/低',
    `clause_no`      VARCHAR(30)      NULL                COMMENT '条款编号，如“第3条”',
    `clause_content` TEXT             NULL                COMMENT '问题条款原文',
    `risk_desc`      TEXT             NULL                COMMENT '风险说明',
    `suggestion`     TEXT             NULL                COMMENT '修改建议',
    `law_id`         BIGINT           NULL                COMMENT '关联法条ID(可空)',
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_risk_contract_id` (`contract_id`),
    KEY `idx_risk_level`       (`risk_level`),
    KEY `idx_risk_law_id`      (`law_id`),
    CONSTRAINT `fk_risk_contract` FOREIGN KEY (`contract_id`) REFERENCES `contract` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_risk_law`      FOREIGN KEY (`law_id`)      REFERENCES `law_article` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='合同风险点表';

-- ---------------------------------------------------------------------------
-- 8. doc_template  法律文书模板表
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `doc_template`;
CREATE TABLE `doc_template` (
    `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '模板主键',
    `code`           VARCHAR(30)  NOT NULL                COMMENT '模板编码，唯一，如 T01',
    `name`           VARCHAR(100) NOT NULL                COMMENT '模板名称',
    `category`       VARCHAR(30)      NULL                COMMENT '分类：仲裁/通知/申请/函件',
    `description`    VARCHAR(255)     NULL                COMMENT '模板说明',
    `content_template` TEXT       NOT NULL                COMMENT '模板正文，占位符形如 ${申请人}',
    `sort_no`        INT          NOT NULL DEFAULT 0      COMMENT '排序号',
    `enabled`        TINYINT      NOT NULL DEFAULT 1      COMMENT '是否启用：1=启用, 0=停用',
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_template_code` (`code`),
    KEY `idx_template_enabled_sort` (`enabled`, `sort_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='法律文书模板表';

-- ---------------------------------------------------------------------------
-- 9. doc_record  用户生成的文书表
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `doc_record`;
CREATE TABLE `doc_record` (
    `id`          BIGINT       NOT NULL AUTO_INCREMENT COMMENT '文书主键',
    `user_id`     BIGINT       NOT NULL                COMMENT '所属用户ID',
    `template_id` BIGINT       NOT NULL                COMMENT '所用模板ID',
    `title`       VARCHAR(200) NOT NULL                COMMENT '文书标题',
    `params_json` TEXT             NULL                COMMENT '填写参数(JSON)',
    `content`     TEXT             NULL                COMMENT '渲染后的文书正文',
    `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    PRIMARY KEY (`id`),
    KEY `idx_doc_user_id`     (`user_id`),
    KEY `idx_doc_template_id` (`template_id`),
    CONSTRAINT `fk_doc_user`     FOREIGN KEY (`user_id`)     REFERENCES `sys_user` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_doc_template` FOREIGN KEY (`template_id`) REFERENCES `doc_template` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户生成的文书表';

-- ---------------------------------------------------------------------------
-- 10. knowledge_article  普法文章表
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `knowledge_article`;
CREATE TABLE `knowledge_article` (
    `id`           BIGINT       NOT NULL AUTO_INCREMENT COMMENT '文章主键',
    `title`        VARCHAR(200) NOT NULL                COMMENT '标题',
    `summary`      VARCHAR(500)     NULL                COMMENT '摘要',
    `content`      TEXT             NULL                COMMENT '正文',
    `category`     VARCHAR(30)      NULL                COMMENT '分类',
    `author`       VARCHAR(50)      NULL                COMMENT '作者',
    `view_count`   INT          NOT NULL DEFAULT 0      COMMENT '阅读量',
    `like_count`   INT          NOT NULL DEFAULT 0      COMMENT '点赞数',
    `status`       TINYINT      NOT NULL DEFAULT 1      COMMENT '状态：1=已发布, 0=草稿',
    `published_at` DATETIME         NULL                COMMENT '发布时间',
    `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_article_status_pub` (`status`, `published_at`),
    KEY `idx_article_category`   (`category`),
    FULLTEXT KEY `ft_article` (`title`, `summary`, `content`) WITH PARSER ngram
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='普法文章表';

-- ---------------------------------------------------------------------------
-- 11. knowledge_tag  标签字典表
-- 12. article_tag    文章↔标签 关联表（多对多桥表）
--     不把标签存成“a,b,c”字符串，避免 1NF 违规。
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `knowledge_tag`;
CREATE TABLE `knowledge_tag` (
    `id`         BIGINT      NOT NULL AUTO_INCREMENT COMMENT '标签主键',
    `name`       VARCHAR(30) NOT NULL                COMMENT '标签名，唯一',
    `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_tag_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='普法文章标签字典表';

DROP TABLE IF EXISTS `article_tag`;
CREATE TABLE `article_tag` (
    `id`         BIGINT   NOT NULL AUTO_INCREMENT COMMENT '主键',
    `article_id` BIGINT   NOT NULL                COMMENT '文章ID',
    `tag_id`     BIGINT   NOT NULL                COMMENT '标签ID',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_article_tag` (`article_id`, `tag_id`),
    KEY `idx_at_tag_id` (`tag_id`),
    CONSTRAINT `fk_at_article` FOREIGN KEY (`article_id`) REFERENCES `knowledge_article` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_at_tag`     FOREIGN KEY (`tag_id`)     REFERENCES `knowledge_tag` (`id`)     ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章标签关联表';

-- ---------------------------------------------------------------------------
-- 13. quiz_question  知识自测题表
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `quiz_question`;
CREATE TABLE `quiz_question` (
    `id`             BIGINT       NOT NULL AUTO_INCREMENT COMMENT '题目主键',
    `category`       VARCHAR(30)      NULL                COMMENT '分类',
    `question`       VARCHAR(500) NOT NULL                COMMENT '题干',
    `option_a`       VARCHAR(300) NOT NULL                COMMENT '选项A',
    `option_b`       VARCHAR(300) NOT NULL                COMMENT '选项B',
    `option_c`       VARCHAR(300) NOT NULL                COMMENT '选项C',
    `option_d`       VARCHAR(300) NOT NULL                COMMENT '选项D',
    `correct_option` CHAR(1)      NOT NULL                COMMENT '正确答案：A/B/C/D',
    `explanation`    VARCHAR(500)     NULL                COMMENT '答案解析',
    `difficulty`     TINYINT      NOT NULL DEFAULT 1      COMMENT '难度：1简单 2中等 3困难',
    `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    PRIMARY KEY (`id`),
    KEY `idx_quiz_category` (`category`),
    KEY `idx_quiz_difficulty` (`difficulty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='知识自测题表';

-- ---------------------------------------------------------------------------
-- 14. favorite  收藏表（用户 × 目标对象 多对多桥表）
--     target_type + target_id 为多态关联，无法加外键，用唯一索引防重复收藏。
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `favorite`;
CREATE TABLE `favorite` (
    `id`          BIGINT      NOT NULL AUTO_INCREMENT COMMENT '主键',
    `user_id`     BIGINT      NOT NULL                COMMENT '用户ID',
    `target_type` VARCHAR(20) NOT NULL                COMMENT '收藏类型：QA=问答, ARTICLE=文章, LAW=法条, DOC=文书',
    `target_id`   BIGINT      NOT NULL                COMMENT '收藏对象ID',
    `created_at`  DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '收藏时间',
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_fav_user_target` (`user_id`, `target_type`, `target_id`),
    KEY `idx_fav_target` (`target_type`, `target_id`),
    CONSTRAINT `fk_fav_user` FOREIGN KEY (`user_id`) REFERENCES `sys_user` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='收藏表';

-- ---------------------------------------------------------------------------
-- 15. operation_log  操作日志表（安全防护 + 后台审计）
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `operation_log`;
CREATE TABLE `operation_log` (
    `id`         BIGINT       NOT NULL AUTO_INCREMENT COMMENT '日志主键',
    `user_id`    BIGINT           NULL                COMMENT '操作用户ID，未登录为空',
    `username`   VARCHAR(50)      NULL                COMMENT '操作用户名',
    `action`     VARCHAR(100)     NULL                COMMENT '操作描述',
    `method`     VARCHAR(10)      NULL                COMMENT 'HTTP方法',
    `uri`        VARCHAR(255)     NULL                COMMENT '请求URI',
    `ip`         VARCHAR(64)      NULL                COMMENT '客户端IP',
    `params`     TEXT             NULL                COMMENT '请求参数摘要(已脱敏)',
    `cost_ms`    BIGINT           NULL                COMMENT '耗时(毫秒)',
    `status`     INT              NULL                COMMENT 'HTTP状态码',
    `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发生时间',
    PRIMARY KEY (`id`),
    KEY `idx_log_user_id`  (`user_id`),
    KEY `idx_log_created`  (`created_at`),
    KEY `idx_log_uri`      (`uri`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='操作日志表';

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
--  视图：后台看板用的统计视图（演示多表关联与聚合）
-- ============================================================================
CREATE OR REPLACE VIEW `v_user_stats` AS
SELECT u.`id`                                        AS user_id,
       u.`username`,
       u.`nickname`,
       (SELECT COUNT(*) FROM `qa_record`    q WHERE q.`user_id` = u.`id`) AS qa_count,
       (SELECT COUNT(*) FROM `contract`     c WHERE c.`user_id` = u.`id`) AS contract_count,
       (SELECT COUNT(*) FROM `doc_record`   d WHERE d.`user_id` = u.`id`) AS doc_count,
       (SELECT COUNT(*) FROM `favorite`     f WHERE f.`user_id` = u.`id`) AS favorite_count
FROM `sys_user` u;
