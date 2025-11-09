USE vms;

-- 1) Ensure each salon has a unique email (NULLs allowed, uniqueness applies to non-NULL)
ALTER TABLE salons
  ADD UNIQUE KEY uq_salons_email (email);

-- 2) Ensure each user can map to at most one salon
-- We already have PRIMARY KEY (salon_id, user_id); add a unique on user_id alone
ALTER TABLE salon_users
  ADD UNIQUE KEY uq_salon_users_user (user_id);
