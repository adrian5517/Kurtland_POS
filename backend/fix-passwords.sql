UPDATE users SET password_hash = '$2b$10$eVi.4hjeph65O5jYlFh2TOiRBJu36VFI7.GZ3CUunPcAGKPKfrdcS' WHERE role = 'cashier';
UPDATE users SET password_hash = '$2b$10$Bch4NvbNPo42MwdZRKmmAu7Kilwwef7uvFZmfYGFvQk4HuliqC52e' WHERE role = 'admin';
SELECT email, role, LENGTH(password_hash) as hash_length FROM users;
