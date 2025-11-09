USE vms;

INSERT IGNORE INTO roles (id, name) VALUES
 (1,'SUPER_ADMIN'),(2,'ADMIN'),(3,'SALON_USER');

-- bcrypt hash for Admin@12345 (pre-generated, no placeholders)
-- $2b$10$u.bUmT6R2LegzlOWvOj0lu/5iCSXpyGDASNatnuPo3FBp7ZNOvLAW
INSERT INTO users (email, password_hash, first_name, last_name, role_id, is_active)
VALUES ('admin@vms.local', '$2b$10$u.bUmT6R2LegzlOWvOj0lu/5iCSXpyGDASNatnuPo3FBp7ZNOvLAW',
        'Super','Admin',1,1);

INSERT INTO salons (name, slug, city, region, country, is_active)
VALUES ('HairBar NYC - Midtown','hairbar-nyc-midtown','New York','NY','US',1);

INSERT INTO campaigns (name, slug, starts_at, is_active)
VALUES ('Fall Promo','fall-promo', NOW(), 1);
