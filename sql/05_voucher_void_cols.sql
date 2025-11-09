USE vms;

ALTER TABLE vouchers
  ADD COLUMN voided_at DATETIME NULL,
  ADD COLUMN voided_by_user_id BIGINT UNSIGNED NULL,
  ADD COLUMN voided_at_salon_id BIGINT UNSIGNED NULL,
  ADD INDEX idx_vouchers_voided_at (voided_at),
  ADD INDEX idx_vouchers_voided_salon (voided_at_salon_id);
