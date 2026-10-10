CREATE TABLE SESSION (session_id TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0 CHECK(revision >= 0));
-- statement-break
CREATE TABLE REGION_MASTER (region_code TEXT PRIMARY KEY,pref TEXT NOT NULL CHECK(pref IN ('東京都','神奈川県')),name TEXT NOT NULL,is_whole_pref INTEGER NOT NULL CHECK(is_whole_pref IN (0,1)));
-- statement-break
CREATE TABLE PARTNER (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT NOT NULL REFERENCES SESSION(session_id) ON DELETE CASCADE, code TEXT NOT NULL,short_name TEXT NOT NULL,capacity INTEGER NOT NULL CHECK(capacity >= 0),active INTEGER NOT NULL CHECK(active IN (0,1)),revision INTEGER NOT NULL DEFAULT 0,UNIQUE(session_id,id),UNIQUE(session_id,code));
-- statement-break
CREATE TABLE PARTNER_FIELD(partner_id INTEGER NOT NULL,session_id TEXT NOT NULL,field TEXT NOT NULL CHECK(field IN ('電気','機械')),PRIMARY KEY(session_id,partner_id,field),FOREIGN KEY(session_id,partner_id) REFERENCES PARTNER(session_id,id) ON DELETE CASCADE);
-- statement-break
CREATE TABLE PARTNER_LICENSE(partner_id INTEGER NOT NULL,session_id TEXT NOT NULL,license TEXT NOT NULL CHECK(license IN ('設備設計一級建築士','建築設備士','1級電気工事施工管理技士','1級管工事施工管理技士','一級建築士')),PRIMARY KEY(session_id,partner_id,license),FOREIGN KEY(session_id,partner_id) REFERENCES PARTNER(session_id,id) ON DELETE CASCADE);
-- statement-break
CREATE TABLE PARTNER_SERVICE(partner_id INTEGER NOT NULL,session_id TEXT NOT NULL,service TEXT NOT NULL CHECK(service IN ('役所打合せ','定例会出席','現地調査','平日電話対応','納品検査出席','積算')),PRIMARY KEY(session_id,partner_id,service),FOREIGN KEY(session_id,partner_id) REFERENCES PARTNER(session_id,id) ON DELETE CASCADE);
-- statement-break
CREATE TABLE PARTNER_REGION(partner_id INTEGER NOT NULL,session_id TEXT NOT NULL,region_code TEXT NOT NULL REFERENCES REGION_MASTER(region_code),PRIMARY KEY(session_id,partner_id,region_code),FOREIGN KEY(session_id,partner_id) REFERENCES PARTNER(session_id,id) ON DELETE CASCADE);
-- statement-break
CREATE TABLE PARTNER_EXPERIENCE(partner_id INTEGER NOT NULL,session_id TEXT NOT NULL,use TEXT NOT NULL CHECK(use IN ('教育施設','公営住宅','公共施設')),work_type TEXT NOT NULL CHECK(work_type IN ('新築','改修')),count INTEGER NOT NULL CHECK(count>=0),PRIMARY KEY(session_id,partner_id,use,work_type),FOREIGN KEY(session_id,partner_id) REFERENCES PARTNER(session_id,id) ON DELETE CASCADE);
-- statement-break
CREATE TABLE PROJECT(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL REFERENCES SESSION(session_id) ON DELETE CASCADE,name TEXT NOT NULL,fields TEXT NOT NULL CHECK(json_valid(fields)),work_type TEXT NOT NULL CHECK(work_type IN ('新築','改修')),use TEXT NOT NULL CHECK(use IN ('教育施設','公営住宅','公共施設')),region_code TEXT NOT NULL REFERENCES REGION_MASTER(region_code),floors INTEGER NOT NULL CHECK(floors>0),floor_area REAL NOT NULL CHECK(floor_area>0),start_date TEXT NOT NULL,due_date TEXT NOT NULL CHECK(start_date<=due_date),order_type TEXT NOT NULL CHECK(order_type IN ('入札','プロポーザル')),require_listed_license INTEGER NOT NULL CHECK(require_listed_license IN (0,1)),state TEXT NOT NULL DEFAULT 'registered' CHECK(state IN ('registered','candidates','partial','assigned')),revision INTEGER NOT NULL DEFAULT 0,UNIQUE(session_id,id));
-- statement-break
CREATE TRIGGER PROJECT_CITY_INSERT BEFORE INSERT ON PROJECT WHEN (SELECT is_whole_pref FROM REGION_MASTER WHERE region_code=NEW.region_code)=1 BEGIN SELECT RAISE(ABORT,'city required'); END;
-- statement-break
CREATE TRIGGER PROJECT_CITY_UPDATE BEFORE UPDATE OF region_code ON PROJECT WHEN (SELECT is_whole_pref FROM REGION_MASTER WHERE region_code=NEW.region_code)=1 BEGIN SELECT RAISE(ABORT,'city required'); END;
-- statement-break
CREATE TABLE PROJECT_SERVICE(project_id INTEGER NOT NULL,session_id TEXT NOT NULL,service TEXT NOT NULL CHECK(service IN ('役所打合せ','定例会出席','現地調査','平日電話対応','納品検査出席','積算')),PRIMARY KEY(session_id,project_id,service),FOREIGN KEY(session_id,project_id) REFERENCES PROJECT(session_id,id) ON DELETE CASCADE);
-- statement-break
CREATE TABLE ASSIGNMENT(id INTEGER PRIMARY KEY AUTOINCREMENT,session_id TEXT NOT NULL,project_id INTEGER NOT NULL,partner_id INTEGER NOT NULL,request_id TEXT NOT NULL,fields TEXT NOT NULL CHECK(json_valid(fields)),status TEXT NOT NULL CHECK(status IN ('confirmed','cancelled')),UNIQUE(session_id,id),UNIQUE(session_id,id,partner_id),UNIQUE(session_id,id,project_id),FOREIGN KEY(session_id,project_id) REFERENCES PROJECT(session_id,id) ON DELETE CASCADE,FOREIGN KEY(session_id,partner_id) REFERENCES PARTNER(session_id,id) ON DELETE RESTRICT);
-- statement-break
CREATE TABLE ASSIGNMENT_FIELD(assignment_id INTEGER NOT NULL,session_id TEXT NOT NULL,project_id INTEGER NOT NULL,field TEXT NOT NULL CHECK(field IN ('電気','機械')),PRIMARY KEY(session_id,assignment_id,field),UNIQUE(session_id,project_id,field),FOREIGN KEY(session_id,assignment_id,project_id) REFERENCES ASSIGNMENT(session_id,id,project_id) ON DELETE CASCADE,FOREIGN KEY(session_id,project_id) REFERENCES PROJECT(session_id,id) ON DELETE CASCADE);
-- statement-break
CREATE TRIGGER ASSIGNMENT_FIELD_PROJECT BEFORE INSERT ON ASSIGNMENT_FIELD WHEN NOT EXISTS(SELECT 1 FROM ASSIGNMENT WHERE id=NEW.assignment_id AND session_id=NEW.session_id AND project_id=NEW.project_id AND status='confirmed') BEGIN SELECT RAISE(ABORT,'assignment mismatch'); END;
-- statement-break
CREATE TABLE ENGAGEMENT(id INTEGER PRIMARY KEY AUTOINCREMENT,partner_id INTEGER NOT NULL,session_id TEXT NOT NULL,start_date TEXT NOT NULL,end_date TEXT NOT NULL CHECK(start_date<=end_date),assignment_id INTEGER,UNIQUE(session_id,id),FOREIGN KEY(session_id,partner_id) REFERENCES PARTNER(session_id,id) ON DELETE CASCADE,FOREIGN KEY(session_id,assignment_id,partner_id) REFERENCES ASSIGNMENT(session_id,id,partner_id) ON DELETE CASCADE);
-- statement-break
CREATE UNIQUE INDEX ENGAGEMENT_ASSIGNMENT ON ENGAGEMENT(session_id,assignment_id) WHERE assignment_id IS NOT NULL;
-- statement-break
CREATE TABLE WRITE_GUARD(session_id TEXT NOT NULL REFERENCES SESSION(session_id) ON DELETE CASCADE,assertion INTEGER NOT NULL CHECK(assertion=1));
-- statement-break
CREATE INDEX ENGAGEMENT_OWNER_PARTNER ON ENGAGEMENT(session_id,partner_id);
-- statement-break
CREATE INDEX ASSIGNMENT_OWNER_PROJECT ON ASSIGNMENT(session_id,project_id);

-- statement-break
CREATE UNIQUE INDEX ASSIGNMENT_ACTIVE_PARTNER ON ASSIGNMENT(session_id,project_id,partner_id) WHERE status='confirmed';
