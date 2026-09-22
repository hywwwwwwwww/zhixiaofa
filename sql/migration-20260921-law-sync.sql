-- ============================================================================
--  迁移脚本：law_article 补齐「法条同步」所需字段
--  日期：2026-09-21
--  目的：让管理端「法律管理」页的
--          · 法律名称下拉（GET /api/law-articles/law-names）
--          · 立即同步（POST /api/law-articles/sync）
--          · 同步状态（GET /api/law-articles/sync/status）
--          · 序号重排（POST /api/law-articles/recompute-seq）
--        以及 LawSyncService / LawSyncScheduleListener 能够正常工作。
--
--  说明：
--   1) 本迁移是**增量**的（只加列、只改可空性、只换一个索引），不删数据。
--   2) DAO 的行映射是按列名取值（ResultSet.getString(rs,"law_name")），
--      因此即使旧代码仍在运行，加列也不会影响它，可安全执行。
--   3) law_name + article_no 由普通索引升为唯一索引，是 LawSyncService
--      「按 (法律,条号) 增量 upsert」的前提。执行前请确认无重复组合：
--        SELECT law_name, article_no, COUNT(*) c FROM law_article
--        GROUP BY law_name, article_no HAVING c > 1;
--
--  回滚见文件末尾。
-- ============================================================================

-- 1) 备份原表
CREATE TABLE IF NOT EXISTS `law_article_bak_20260921` AS SELECT * FROM `law_article`;

-- 2) 加字段（位置与 sql/schema.sql 保持一致）
ALTER TABLE `law_article`
  ADD COLUMN `seq`       INT             NULL COMMENT '法律内序号（该法律的第几条，从 1 开始）' AFTER `article_no`,
  ADD COLUMN `source`    VARCHAR(50) NOT NULL DEFAULT 'manual' COMMENT '来源：manual=手工录入 / flk_npc=国家法律法规数据库同步' AFTER `effective_date`,
  ADD COLUMN `source_id` VARCHAR(64)     NULL COMMENT '来源侧唯一标识（国家法律法规数据库的 bbbs）' AFTER `source`;

-- 3) 正文允许为空（自动同步时部分条文可能未命中正文）
ALTER TABLE `law_article`
  MODIFY COLUMN `content` TEXT NULL COMMENT '条文正文（自动同步时部分条文可能未命中正文，允许为空）',
  MODIFY COLUMN `title`   VARCHAR(200) NULL COMMENT '条文标题（可为章节名）';

-- 4) law_name + article_no 升为唯一索引
ALTER TABLE `law_article` DROP INDEX `idx_law_name_no`;
ALTER TABLE `law_article` ADD UNIQUE KEY `uk_law_name_no` (`law_name`, `article_no`);

-- 5) 存量数据回填 seq（按 id 顺序，等价于原插入顺序；
--    之后「重排序号」按钮或新增法条时会被 recomputeSeq 按中文条号精确重排）
UPDATE `law_article` la
JOIN (
  SELECT `id`, ROW_NUMBER() OVER (PARTITION BY `law_name` ORDER BY `id`) AS rn
  FROM `law_article`
) t ON t.`id` = la.`id`
SET la.`seq` = t.rn;

-- ============================================================================
--  回滚（如需撤销）
--    ALTER TABLE `law_article` DROP INDEX `uk_law_name_no`;
--    ALTER TABLE `law_article` ADD INDEX `idx_law_name_no` (`law_name`, `article_no`);
--    ALTER TABLE `law_article`
--      DROP COLUMN `seq`, DROP COLUMN `source`, DROP COLUMN `source_id`;
--    ALTER TABLE `law_article`
--      MODIFY COLUMN `content` TEXT NOT NULL;
--  （数据无需还原；如需完全还原，可从 law_article_bak_20260921 恢复）
-- ============================================================================
