-- TABLA DE USUARIOS
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    correo VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('ADMIN', 'DIRECTOR', 'SECRETARIA', 'DOCENTE')),
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE ESTUDIANTES
CREATE TABLE IF NOT EXISTS estudiantes (
    id SERIAL PRIMARY KEY,
    rude VARCHAR(30) UNIQUE NOT NULL,
    ci VARCHAR(20) UNIQUE,
    complemento VARCHAR(5),
    expedido VARCHAR(10),
    nombres VARCHAR(100) NOT NULL,
    primer_apellido VARCHAR(100) NOT NULL,
    segundo_apellido VARCHAR(100),
    fecha_nacimiento DATE NOT NULL,
    genero CHAR(1) CHECK (genero IN ('M', 'F')),
    estado VARCHAR(20) DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'INACTIVO', 'RETIRADO')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DETALLE RUDE (Campos del Formulario R.M. 0684/2025)
CREATE TABLE IF NOT EXISTS rude_detalles (
    id SERIAL PRIMARY KEY,
    estudiante_id INT UNIQUE NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    
    cert_oficialia VARCHAR(50),
    cert_libro VARCHAR(50),
    cert_partida VARCHAR(50),
    cert_folio VARCHAR(50),
    
    presenta_discapacidad BOOLEAN DEFAULT FALSE,
    num_carnet_discapacidad VARCHAR(50),
    tipo_discapacidad VARCHAR(50),
    grado_discapacidad VARCHAR(50),
    trastorno_tea VARCHAR(50),
    dificultad_aprendizaje VARCHAR(100),
    talento_extraordinario VARCHAR(100),
    
    depa_residencia VARCHAR(50),
    provincia_residencia VARCHAR(50),
    municipio_residencia VARCHAR(50),
    localidad_residencia VARCHAR(100),
    zona_barrio VARCHAR(100),
    avenida_calle VARCHAR(100),
    num_vivienda VARCHAR(20),
    telefono_fijo VARCHAR(20),
    celular_contacto VARCHAR(20),
    
    idioma_niñez VARCHAR(50),
    idiomas_frecuentes VARCHAR(100),
    autoidentificacion_cultural VARCHAR(100),
    centro_salud_acceso BOOLEAN DEFAULT FALSE,
    seguro_salud BOOLEAN DEFAULT FALSE,
    servicio_agua BOOLEAN DEFAULT FALSE,
    servicio_electricidad BOOLEAN DEFAULT FALSE,
    servicio_alcantarillado BOOLEAN DEFAULT FALSE,
    servicio_basura BOOLEAN DEFAULT FALSE,
    vivienda_condicion VARCHAR(50),
    actividad_laboral BOOLEAN DEFAULT FALSE,
    transporte_llegada VARCHAR(50),
    tiempo_transporte VARCHAR(50),
    
    convive_con VARCHAR(50),
    padre_ci VARCHAR(20),
    padre_nombres VARCHAR(100),
    padre_apellidos VARCHAR(100),
    padre_idioma VARCHAR(50),
    padre_ocupacion VARCHAR(100),
    padre_instruccion VARCHAR(100),
    
    madre_ci VARCHAR(20),
    madre_nombres VARCHAR(100),
    madre_apellidos VARCHAR(100),
    madre_idioma VARCHAR(50),
    madre_ocupacion VARCHAR(100),
    madre_instruccion VARCHAR(100),
    
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- TABLA DE CURSOS
CREATE TABLE IF NOT EXISTS cursos (
    id SERIAL PRIMARY KEY,
    nivel VARCHAR(50) NOT NULL CHECK (nivel IN ('INICIAL', 'PRIMARIA', 'SECUNDARIA')),
    grado INT NOT NULL CHECK (grado BETWEEN 1 AND 6),
    paralelo VARCHAR(5) NOT NULL,
    turno VARCHAR(20) NOT NULL CHECK (turno IN ('MAÑANA', 'TARDE', 'NOCHE')),
    gestion INT NOT NULL,
    codigo_sie VARCHAR(20),
    activo BOOLEAN DEFAULT TRUE,
    CONSTRAINT unique_curso_gestion UNIQUE (nivel, grado, paralelo, turno, gestion)
);

-- TABLA DE INSCRIPCIONES
CREATE TABLE IF NOT EXISTS inscripciones (
    id SERIAL PRIMARY KEY,
    estudiante_id INT NOT NULL REFERENCES estudiantes(id) ON DELETE RESTRICT,
    curso_id INT NOT NULL REFERENCES cursos(id) ON DELETE RESTRICT,
    gestion INT NOT NULL,
    fecha_inscripcion DATE DEFAULT CURRENT_DATE,
    estado VARCHAR(20) DEFAULT 'CONFIRMADA' CHECK (estado IN ('CONFIRMADA', 'ANULADA', 'CANCELADA')),
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_estudiante_gestion UNIQUE (estudiante_id, gestion)
);

-- TABLA DE MATRICULAS
CREATE TABLE IF NOT EXISTS matriculas (
    id SERIAL PRIMARY KEY,
    inscripcion_id INT UNIQUE NOT NULL REFERENCES inscripciones(id) ON DELETE RESTRICT,
    codigo_matricula VARCHAR(50) UNIQUE NOT NULL,
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT
);