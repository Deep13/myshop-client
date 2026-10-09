-- Remembers which column of a distributor's Excel bill holds which of our fields,
-- so the mapping is asked for once per distributor and reused from then on.
--
-- Keyed on (distributor, column-layout hash) rather than distributor alone: a
-- supplier who sends two different formats keeps a mapping for each instead of
-- the second overwriting the first.
--
-- Run once, before deploying get_distributor_mapping.php / save_distributor_mapping.php.

CREATE TABLE IF NOT EXISTS distributor_mappings (
  id             INT(11)      NOT NULL AUTO_INCREMENT,
  distributor_id INT(11)      NOT NULL,
  headers_hash   CHAR(32)     NOT NULL COMMENT 'md5 of the header row, so one distributor can have several layouts',
  headers_json   TEXT         NOT NULL COMMENT 'the header row as uploaded, for showing what was mapped',
  col_map_json   TEXT         NOT NULL COMMENT 'our field name -> column index',
  created_at     TIMESTAMP    NOT NULL DEFAULT current_timestamp(),
  updated_at     TIMESTAMP    NULL DEFAULT NULL ON UPDATE current_timestamp(),
  PRIMARY KEY (id),
  UNIQUE KEY uniq_dist_headers (distributor_id, headers_hash),
  KEY idx_dist (distributor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
