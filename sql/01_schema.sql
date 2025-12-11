CREATE DATABASE IF NOT EXISTS vms CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE vms;

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id TINYINT UNSIGNED PRIMARY KEY,
  name VARCHAR(32) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(80),
  last_name VARCHAR(80),
  role_id TINYINT UNSIGNED NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB;

-- Salons
CREATE TABLE IF NOT EXISTS salons (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(190) NOT NULL,
  phone VARCHAR(40),
  email VARCHAR(190),
  address_line1 VARCHAR(190),
  address_line2 VARCHAR(190),
  city VARCHAR(120),
  region VARCHAR(120),
  postal_code VARCHAR(20),
  country VARCHAR(2) DEFAULT 'CA',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Salon ↔ Users map (role within salon)
CREATE TABLE IF NOT EXISTS salon_users (
  salon_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  role_in_salon ENUM('ADMIN','STAFF') NOT NULL DEFAULT 'STAFF',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  PRIMARY KEY (salon_id, user_id),
  CONSTRAINT fk_salon_users_salon FOREIGN KEY (salon_id) REFERENCES salons(id) ON DELETE CASCADE,
  CONSTRAINT fk_salon_users_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Customers (lightweight)
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(190),
  phone VARCHAR(40),
  first_name VARCHAR(80),
  last_name VARCHAR(80),
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  UNIQUE KEY uq_customer_email_phone (email, phone)
) ENGINE=InnoDB;

-- Orders (from storefronts)
CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  external_id VARCHAR(64) NOT NULL,
  order_id VARCHAR(64) NULL,
  source VARCHAR(32) NOT NULL,
  customer_id BIGINT UNSIGNED,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  order_total DECIMAL(10,2) NULL,
  currency CHAR(3) DEFAULT 'CAD',
  status ENUM('PENDING','COMPLETED','CANCELLED','REFUNDED') DEFAULT 'COMPLETED',
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  UNIQUE KEY uq_orders_source_external (source, external_id)
) ENGINE=InnoDB;

-- Order products
CREATE TABLE IF NOT EXISTS order_products (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id VARCHAR(64) NULL,
  product_name VARCHAR(190) NOT NULL,
  product_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_order_products_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Vouchers
CREATE TABLE IF NOT EXISTS vouchers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code VARCHAR(24) NOT NULL UNIQUE,
  salon_id BIGINT UNSIGNED NULL,
  order_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  title VARCHAR(190) NOT NULL,
  face_value DECIMAL(10,2) DEFAULT 0.00,
  currency CHAR(3) DEFAULT 'CAD',
  status ENUM('AVAILABLE','REDEEMED','VOID') NOT NULL DEFAULT 'AVAILABLE',
  expires_at DATETIME NULL,
  notes TEXT,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vouchers_salon FOREIGN KEY (salon_id) REFERENCES salons(id),
  CONSTRAINT fk_vouchers_order FOREIGN KEY (order_id) REFERENCES orders(id),
  CONSTRAINT fk_vouchers_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB;

-- Redemptions
CREATE TABLE IF NOT EXISTS redemptions (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  voucher_id BIGINT UNSIGNED NOT NULL,
  salon_id BIGINT UNSIGNED NOT NULL,
  staff_user_id BIGINT UNSIGNED NOT NULL,
  redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_redemptions_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
  CONSTRAINT fk_redemptions_salon FOREIGN KEY (salon_id) REFERENCES salons(id),
  CONSTRAINT fk_redemptions_staff FOREIGN KEY (staff_user_id) REFERENCES users(id),
  UNIQUE KEY uq_redemptions_voucher (voucher_id)
) ENGINE=InnoDB;

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(190) NOT NULL,
  slug VARCHAR(190) NOT NULL UNIQUE,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  is_active TINYINT(1) DEFAULT 1,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS voucher_campaigns (
  voucher_id BIGINT UNSIGNED NOT NULL,
  campaign_id BIGINT UNSIGNED NOT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  PRIMARY KEY (voucher_id, campaign_id),
  CONSTRAINT fk_vc_voucher FOREIGN KEY (voucher_id) REFERENCES vouchers(id) ON DELETE CASCADE,
  CONSTRAINT fk_vc_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  actor_user_id BIGINT UNSIGNED NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(64) NOT NULL,
  entity_id BIGINT UNSIGNED NULL,
  ip VARCHAR(45) NULL,
  ua VARCHAR(255) NULL,
  payload JSON NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES users(id)
) ENGINE=InnoDB;

-- API keys (optional)
CREATE TABLE IF NOT EXISTS api_keys (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  label VARCHAR(190) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  created_by BIGINT UNSIGNED NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  deleted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_keys_user FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB;
