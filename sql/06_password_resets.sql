USE vms;

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  email VARCHAR(190) NOT NULL,
  otp_code CHAR(6) NOT NULL,
  otp_expires_at DATETIME NOT NULL,
  resend_after DATETIME NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_pr_email (email),
  INDEX idx_pr_user (user_id),
  INDEX idx_pr_expires (otp_expires_at)
) ENGINE=InnoDB;
