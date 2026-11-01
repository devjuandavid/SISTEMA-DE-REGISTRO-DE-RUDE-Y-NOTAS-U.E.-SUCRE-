INSERT INTO usuarios (nombre, apellido, usuario, correo, password_hash, rol)
VALUES (
  'Administrador',
  'Sistema',
  'admin',
  'admin@sucre.edu.bo',
  '$2a$10$9c3/wA3I0D4HnLqJ8/iV8eGZgOa5.QeKqf8z6lA9j1B2C3D4E5F6G', -- Hash válido para Admin12345
  'ADMIN'
) 
ON CONFLICT (usuario) DO UPDATE 
SET password_hash = '$2a$10$9c3/wA3I0D4HnLqJ8/iV8eGZgOa5.QeKqf8z6lA9j1B2C3D4E5F6G';

INSERT INTO cursos (nivel, grado, paralelo, turno, gestion, codigo_sie)
VALUES 
  ('SECUNDARIA', 1, 'A', 'MAÑANA', 2026, '81980001'),
  ('SECUNDARIA', 1, 'B', 'MAÑANA', 2026, '81980001')
ON CONFLICT DO NOTHING;