const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function setupDatabase() {
  try {
    console.log('🔄 Inicializando base de datos en PostgreSQL...');

    // 1. Ejecutar Schema
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schemaSql);
    console.log('✅ Esquema y tablas verificadas/creadas.');

    // 2. Generar hash real para la contraseña Admin12345
    const passwordHash = await bcrypt.hash('Admin12345', 10);

    // 3. Insertar o actualizar usuario administrador
    const insertAdminQuery = `
      INSERT INTO usuarios (nombre, apellido, usuario, correo, password_hash, rol)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (usuario) DO UPDATE 
      SET password_hash = EXCLUDED.password_hash;
    `;
    await pool.query(insertAdminQuery, [
      'Administrador',
      'Sistema',
      'admin',
      'admin@sucre.edu.bo',
      passwordHash,
      'ADMIN'
    ]);

    // 4. Cursos iniciales
    const insertCursosQuery = `
      INSERT INTO cursos (nivel, grado, paralelo, turno, gestion, codigo_sie)
      VALUES 
        ('SECUNDARIA', 1, 'A', 'MAÑANA', 2026, '81980001'),
        ('SECUNDARIA', 1, 'B', 'MAÑANA', 2026, '81980001')
      ON CONFLICT DO NOTHING;
    `;
    await pool.query(insertCursosQuery);

    console.log('✅ Usuario administrador (admin / Admin12345) configurado exitosamente.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error configurando la base de datos:', error.message);
    process.exit(1);
  }
}

setupDatabase();