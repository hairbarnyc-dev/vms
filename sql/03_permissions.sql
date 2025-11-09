USE vms;

-- Permissions master
CREATE TABLE IF NOT EXISTS permissions (
  code VARCHAR(64) PRIMARY KEY,
  label VARCHAR(190) NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- User-to-permission mapping
CREATE TABLE IF NOT EXISTS user_permissions (
  user_id BIGINT UNSIGNED NOT NULL,
  perm_code VARCHAR(64) NOT NULL,
  PRIMARY KEY (user_id, perm_code),
  CONSTRAINT fk_up_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_up_perm FOREIGN KEY (perm_code) REFERENCES permissions(code) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed core salon permissions
INSERT IGNORE INTO permissions (code, label) VALUES
 ('SALON_VOUCHER_VIEW',   'View vouchers belonging to own salon'),
 ('SALON_VOUCHER_REDEEM', 'Redeem vouchers belonging to own salon');

-- Optional: give SUPER_ADMIN everything (done at application level),
-- Admin will use admin UI routes; salon users get a subset during creation.

INSERT IGNORE INTO permissions (code,label) VALUES
('SALON_VOUCHER_VOID','Void vouchers at own salon');