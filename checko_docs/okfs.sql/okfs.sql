
-- ----------------------------
-- Table structure for okfs
-- ----------------------------
DROP TABLE IF EXISTS "public"."okfs";
CREATE TABLE "public"."okfs" (
  "code" text COLLATE "pg_catalog"."default" NOT NULL,
  "name" text COLLATE "pg_catalog"."default" NOT NULL DEFAULT ''::text
)
;

-- ----------------------------
-- Records of okfs
-- ----------------------------
INSERT INTO "public"."okfs" VALUES ('10', 'РОССИЙСКАЯ СОБСТВЕННОСТЬ');
INSERT INTO "public"."okfs" VALUES ('11', 'Государственная собственность');
INSERT INTO "public"."okfs" VALUES ('12', 'Федеральная собственность');
INSERT INTO "public"."okfs" VALUES ('13', 'Собственность субъектов Российской Федерации');
INSERT INTO "public"."okfs" VALUES ('14', 'Муниципальная собственность');
INSERT INTO "public"."okfs" VALUES ('16', 'Частная собственность');
INSERT INTO "public"."okfs" VALUES ('18', 'Собственность российских граждан, постоянно проживающих за границей');
INSERT INTO "public"."okfs" VALUES ('19', 'Собственность потребительской кооперации');
INSERT INTO "public"."okfs" VALUES ('15', 'Собственность общественных и религиозных организаций (объединений)');
INSERT INTO "public"."okfs" VALUES ('50', 'Собственность благотворительных организаций');
INSERT INTO "public"."okfs" VALUES ('51', 'Собственность политических общественных объединений');
INSERT INTO "public"."okfs" VALUES ('52', 'Собственность профессиональных союзов');
INSERT INTO "public"."okfs" VALUES ('53', 'Собственность общественных объединений');
INSERT INTO "public"."okfs" VALUES ('54', 'Собственность религиозных объединений');
INSERT INTO "public"."okfs" VALUES ('17', 'Смешанная российская собственность');
INSERT INTO "public"."okfs" VALUES ('40', 'Смешанная российская собственность с долей государственной собственности');
INSERT INTO "public"."okfs" VALUES ('41', 'Смешанная российская собственность с долей федеральной собственности');
INSERT INTO "public"."okfs" VALUES ('42', 'Смешанная российская собственность с долей собственности субъектов Российской Федерации');
INSERT INTO "public"."okfs" VALUES ('43', 'Смешанная российская собственность с долями федеральной собственности и собственности субъектов Российской Федерации');
INSERT INTO "public"."okfs" VALUES ('49', 'Иная смешанная российская собственность');
INSERT INTO "public"."okfs" VALUES ('20', 'ИНОСТРАННАЯ СОБСТВЕННОСТЬ');
INSERT INTO "public"."okfs" VALUES ('21', 'Собственность международных организаций');
INSERT INTO "public"."okfs" VALUES ('22', 'Собственность иностранных государств');
INSERT INTO "public"."okfs" VALUES ('23', 'Собственность иностранных юридических лиц');
INSERT INTO "public"."okfs" VALUES ('24', 'Собственность иностранных граждан и лиц без гражданства');
INSERT INTO "public"."okfs" VALUES ('27', 'Смешанная иностранная собственность');
INSERT INTO "public"."okfs" VALUES ('30', 'СОВМЕСТНАЯ РОССИЙСКАЯ И ИНОСТРАННАЯ СОБСТВЕННОСТЬ');
INSERT INTO "public"."okfs" VALUES ('31', 'Совместная федеральная и иностранная собственность');
INSERT INTO "public"."okfs" VALUES ('32', 'Совместная собственность субъектов Российской Федерации и иностранная собственность');
INSERT INTO "public"."okfs" VALUES ('33', 'Совместная муниципальная и иностранная собственность');
INSERT INTO "public"."okfs" VALUES ('34', 'Совместная частная и иностранная собственность');
INSERT INTO "public"."okfs" VALUES ('35', 'Совместная собственность общественных и религиозных организаций (объединений) и иностранная собственность');
INSERT INTO "public"."okfs" VALUES ('61', 'Собственность государственных корпораций');

-- ----------------------------
-- Primary Key structure for table okfs
-- ----------------------------
ALTER TABLE "public"."okfs" ADD CONSTRAINT "okfs_pkey" PRIMARY KEY ("code");
