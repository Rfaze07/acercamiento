const { queryMYSQL } = require("../../database")

exports.getAll = filtros => {
    let sql = `
        SELECT t.*, tc.nombre AS tipo_competencia
        FROM torneos t
        INNER JOIN tipos_competencia tc ON tc.id = t.id_tipo_competencia_fk
        WHERE 1 = 1
    `
    const params = []
    if (filtros.activo !== "t") {
        sql += " AND t.activo = ?"
        params.push(filtros.activo)
    }
    if (filtros.tipo !== "t") {
        sql += " AND t.id_tipo_competencia_fk = ?"
        params.push(filtros.tipo)
    }
    if (filtros.estado !== "t") {
        sql += " AND t.estado = ?"
        params.push(filtros.estado)
    }
    sql += " ORDER BY t.temporada DESC, t.nombre"
    return queryMYSQL(sql, params)
}

exports.getById = id => queryMYSQL(`
    SELECT t.*
    FROM torneos t
    WHERE t.id = ?
`, [id])

exports.insert = torneo => queryMYSQL(`
    INSERT INTO torneos
        (id_tipo_competencia_fk, nombre, temporada, descripcion, fecha_inicio, fecha_fin, estado)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`, [
    torneo.id_tipo_competencia_fk,
    torneo.nombre,
    torneo.temporada,
    torneo.descripcion,
    torneo.fecha_inicio,
    torneo.fecha_fin,
    torneo.estado
])

exports.update = torneo => queryMYSQL(`
    UPDATE torneos
    SET id_tipo_competencia_fk = ?, nombre = ?, temporada = ?, descripcion = ?,
        fecha_inicio = ?, fecha_fin = ?, estado = ?, activo = ?
    WHERE id = ?
`, [
    torneo.id_tipo_competencia_fk,
    torneo.nombre,
    torneo.temporada,
    torneo.descripcion,
    torneo.fecha_inicio,
    torneo.fecha_fin,
    torneo.estado,
    torneo.activo,
    torneo.id
])

exports.delete = id => queryMYSQL(`
    UPDATE torneos
    SET activo = 0
    WHERE id = ?
`, [id])

exports.getOrganizacion = id => Promise.all([
    queryMYSQL(`
        SELECT c.*
        FROM torneos_categorias c
        WHERE c.id_torneo_fk = ? AND c.activo = 1
        ORDER BY c.orden, c.nombre
    `, [id]),
    queryMYSQL(`
        SELECT te.*, c.nombre AS categoria, c.rama, e.nombre AS equipo,
            (SELECT COUNT(*) FROM torneos_equipos_jugadores tej
             WHERE tej.id_torneo_equipo_fk = te.id AND tej.estado = 'activo') AS cantidad_jugadores
        FROM torneos_equipos te
        INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
        INNER JOIN equipos e ON e.id = te.id_equipo_fk
        WHERE c.id_torneo_fk = ? AND c.activo = 1 AND te.activo = 1
        ORDER BY c.orden, c.nombre, e.nombre
    `, [id]),
    queryMYSQL(`
        SELECT tej.*, te.id_torneo_categoria_fk, j.nombre AS jugador, e.nombre AS equipo,
            c.nombre AS categoria
        FROM torneos_equipos_jugadores tej
        INNER JOIN torneos_equipos te ON te.id = tej.id_torneo_equipo_fk
        INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
        INNER JOIN equipos e ON e.id = te.id_equipo_fk
        INNER JOIN jugadores j ON j.id = tej.id_jugador_fk
        WHERE c.id_torneo_fk = ? AND te.activo = 1 AND c.activo = 1
        ORDER BY c.orden, e.nombre, tej.dorsal, j.nombre
    `, [id]),
    queryMYSQL(`
        SELECT f.*, c.nombre AS categoria
        FROM fases f
        INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
        WHERE c.id_torneo_fk = ? AND c.activo = 1 AND f.activo = 1
        ORDER BY c.orden, f.orden, f.nombre
    `, [id]),
    queryMYSQL(`
        SELECT g.*, f.nombre AS fase, c.nombre AS categoria, f.id_torneo_categoria_fk
        FROM grupos g
        INNER JOIN fases f ON f.id = g.id_fase_fk
        INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
        WHERE c.id_torneo_fk = ? AND c.activo = 1 AND f.activo = 1 AND g.activo = 1
        ORDER BY c.orden, f.orden, g.orden, g.nombre
    `, [id]),
    queryMYSQL(`
        SELECT ge.*, g.nombre AS grupo, g.id_fase_fk, te.id AS id_torneo_equipo_fk,
            te.id_torneo_categoria_fk, e.nombre AS equipo, c.nombre AS categoria
        FROM grupos_equipos ge
        INNER JOIN grupos g ON g.id = ge.id_grupo_fk
        INNER JOIN fases f ON f.id = g.id_fase_fk
        INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
        INNER JOIN torneos_equipos te ON te.id = ge.id_torneo_equipo_fk
        INNER JOIN equipos e ON e.id = te.id_equipo_fk
        WHERE c.id_torneo_fk = ? AND c.activo = 1 AND f.activo = 1
            AND g.activo = 1 AND te.activo = 1 AND ge.activo = 1
        ORDER BY g.orden, g.nombre, ge.orden, e.nombre
    `, [id]),
    queryMYSQL(`
        SELECT id, nombre
        FROM equipos
        WHERE activo = 1
        ORDER BY nombre
    `, []),
    queryMYSQL(`
        SELECT id, nombre
        FROM jugadores
        WHERE activo = 1
        ORDER BY nombre
    `, [])
]).then(([categorias, inscripciones, planteles, fases, grupos, equiposPorGrupo, equipos, jugadores]) => ({
    categorias,
    inscripciones,
    planteles,
    fases,
    grupos,
    equiposPorGrupo,
    equipos,
    jugadores
}))

exports.getCategoria = (id, torneoId) => queryMYSQL(`
    SELECT id
    FROM torneos_categorias
    WHERE id = ? AND id_torneo_fk = ? AND activo = 1
`, [id, torneoId])

exports.getCategoriaByNombre = (torneoId, nombre, rama) => queryMYSQL(`
    SELECT id, activo
    FROM torneos_categorias
    WHERE id_torneo_fk = ? AND nombre = ? AND rama = ?
`, [torneoId, nombre, rama])

exports.reactivarCategoria = categoria => queryMYSQL(`
    UPDATE torneos_categorias
    SET nombre = ?, rama = ?, edad_desde = ?, edad_hasta = ?, formato = ?, orden = ?,
        observaciones = ?, activo = 1
    WHERE id = ? AND id_torneo_fk = ?
`, [
    categoria.nombre,
    categoria.rama,
    categoria.edad_desde,
    categoria.edad_hasta,
    categoria.formato,
    categoria.orden,
    categoria.observaciones,
    categoria.id,
    categoria.id_torneo_fk
])

exports.insertCategoria = categoria => queryMYSQL(`
    INSERT INTO torneos_categorias
        (id_torneo_fk, nombre, rama, edad_desde, edad_hasta, formato, orden, observaciones)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`, [
    categoria.id_torneo_fk,
    categoria.nombre,
    categoria.rama,
    categoria.edad_desde,
    categoria.edad_hasta,
    categoria.formato,
    categoria.orden,
    categoria.observaciones
])

exports.updateCategoria = categoria => queryMYSQL(`
    UPDATE torneos_categorias
    SET nombre = ?, rama = ?, edad_desde = ?, edad_hasta = ?, formato = ?, orden = ?, observaciones = ?
    WHERE id = ? AND id_torneo_fk = ? AND activo = 1
`, [
    categoria.nombre,
    categoria.rama,
    categoria.edad_desde,
    categoria.edad_hasta,
    categoria.formato,
    categoria.orden,
    categoria.observaciones,
    categoria.id,
    categoria.id_torneo_fk
])

exports.deleteCategoria = (id, torneoId) => queryMYSQL(`
    UPDATE torneos_categorias
    SET activo = 0
    WHERE id = ? AND id_torneo_fk = ? AND activo = 1
`, [id, torneoId])

exports.insertInscripcion = inscripcion => queryMYSQL(`
    INSERT INTO torneos_equipos
        (id_torneo_categoria_fk, id_equipo_fk, nombre_inscripcion, estado, observaciones)
    SELECT c.id, e.id, ?, ?, ?
    FROM torneos_categorias c
    INNER JOIN equipos e ON e.id = ?
    WHERE c.id = ? AND c.id_torneo_fk = ? AND c.activo = 1 AND e.activo = 1
`, [
    inscripcion.nombre_inscripcion,
    inscripcion.estado,
    inscripcion.observaciones,
    inscripcion.id_equipo_fk,
    inscripcion.id_torneo_categoria_fk,
    inscripcion.id_torneo_fk
])

exports.getInscripcionByPair = (categoriaId, equipoId) => queryMYSQL(`
    SELECT id, activo
    FROM torneos_equipos
    WHERE id_torneo_categoria_fk = ? AND id_equipo_fk = ?
`, [categoriaId, equipoId])

exports.updateInscripcion = inscripcion => queryMYSQL(`
    UPDATE torneos_equipos te
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    SET te.nombre_inscripcion = ?, te.estado = ?, te.observaciones = ?
    WHERE te.id = ? AND c.id_torneo_fk = ? AND te.activo = 1 AND c.activo = 1
`, [
    inscripcion.nombre_inscripcion,
    inscripcion.estado,
    inscripcion.observaciones,
    inscripcion.id,
    inscripcion.id_torneo_fk
])

exports.reactivarInscripcion = inscripcion => queryMYSQL(`
    UPDATE torneos_equipos te
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    SET te.activo = 1, te.estado = ?, te.nombre_inscripcion = ?, te.observaciones = ?
    WHERE te.id = ? AND c.id_torneo_fk = ? AND c.activo = 1
`, [
    inscripcion.estado,
    inscripcion.nombre_inscripcion,
    inscripcion.observaciones,
    inscripcion.id,
    inscripcion.id_torneo_fk
])

exports.deleteInscripcion = (id, torneoId) => queryMYSQL(`
    UPDATE torneos_equipos te
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    SET te.activo = 0, te.estado = 'retirado'
    WHERE te.id = ? AND c.id_torneo_fk = ? AND te.activo = 1
`, [id, torneoId])

exports.getInscripcion = (id, torneoId) => queryMYSQL(`
    SELECT te.id, te.id_torneo_categoria_fk
    FROM torneos_equipos te
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    WHERE te.id = ? AND c.id_torneo_fk = ? AND c.activo = 1 AND te.activo = 1
`, [id, torneoId])

exports.getJugador = id => queryMYSQL(`
    SELECT id
    FROM jugadores
    WHERE id = ? AND activo = 1
`, [id])

exports.getEquipo = id => queryMYSQL(`
    SELECT id
    FROM equipos
    WHERE id = ? AND activo = 1
`, [id])

exports.getPlantelEntry = (id, torneoId) => queryMYSQL(`
    SELECT tej.id, tej.id_torneo_equipo_fk, tej.id_jugador_fk, tej.estado
    FROM torneos_equipos_jugadores tej
    INNER JOIN torneos_equipos te ON te.id = tej.id_torneo_equipo_fk
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    WHERE tej.id = ? AND c.id_torneo_fk = ? AND te.activo = 1 AND c.activo = 1
`, [id, torneoId])

exports.getDorsalConflict = (inscripcionId, dorsal, jugadorId, plantelId) => queryMYSQL(`
    SELECT id
    FROM torneos_equipos_jugadores
    WHERE id_torneo_equipo_fk = ? AND dorsal = ? AND estado = 'activo'
        AND id_jugador_fk <> ? AND id <> ?
    LIMIT 1
`, [inscripcionId, dorsal, jugadorId, plantelId || 0])

exports.insertJugadorPlantel = plantel => queryMYSQL(`
    INSERT INTO torneos_equipos_jugadores
        (id_torneo_equipo_fk, id_jugador_fk, dorsal, fecha_alta, fecha_baja, estado, observaciones)
    SELECT te.id, j.id, ?, ?, ?, ?, ?
    FROM torneos_equipos te
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    INNER JOIN jugadores j ON j.id = ?
    WHERE te.id = ? AND c.id_torneo_fk = ? AND te.activo = 1 AND c.activo = 1 AND j.activo = 1
`, [
    plantel.dorsal,
    plantel.fecha_alta,
    plantel.fecha_baja,
    plantel.estado,
    plantel.observaciones,
    plantel.id_jugador_fk,
    plantel.id_torneo_equipo_fk,
    plantel.id_torneo_fk
])

exports.getJugadorPlantelByPair = (inscripcionId, jugadorId) => queryMYSQL(`
    SELECT id, estado
    FROM torneos_equipos_jugadores
    WHERE id_torneo_equipo_fk = ? AND id_jugador_fk = ?
`, [inscripcionId, jugadorId])

exports.updateJugadorPlantel = plantel => queryMYSQL(`
    UPDATE torneos_equipos_jugadores tej
    INNER JOIN torneos_equipos te ON te.id = tej.id_torneo_equipo_fk
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    SET tej.dorsal = ?, tej.fecha_alta = ?, tej.fecha_baja = ?, tej.estado = ?, tej.observaciones = ?
    WHERE tej.id = ? AND c.id_torneo_fk = ? AND te.activo = 1 AND c.activo = 1
`, [
    plantel.dorsal,
    plantel.fecha_alta,
    plantel.fecha_baja,
    plantel.estado,
    plantel.observaciones,
    plantel.id,
    plantel.id_torneo_fk
])

exports.reactivarJugadorPlantel = plantel => queryMYSQL(`
    UPDATE torneos_equipos_jugadores tej
    INNER JOIN torneos_equipos te ON te.id = tej.id_torneo_equipo_fk
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    SET tej.dorsal = ?, tej.fecha_alta = ?, tej.fecha_baja = NULL, tej.estado = 'activo',
        tej.observaciones = ?
    WHERE tej.id = ? AND c.id_torneo_fk = ? AND te.activo = 1 AND c.activo = 1
`, [
    plantel.dorsal,
    plantel.fecha_alta,
    plantel.observaciones,
    plantel.id,
    plantel.id_torneo_fk
])

exports.deleteJugadorPlantel = (id, torneoId) => queryMYSQL(`
    UPDATE torneos_equipos_jugadores tej
    INNER JOIN torneos_equipos te ON te.id = tej.id_torneo_equipo_fk
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    SET tej.estado = 'baja', tej.fecha_baja = CURDATE()
    WHERE tej.id = ? AND c.id_torneo_fk = ? AND te.activo = 1 AND c.activo = 1
`, [id, torneoId])

exports.insertFase = fase => queryMYSQL(`
    INSERT INTO fases
        (id_torneo_categoria_fk, nombre, tipo, formato, orden, cantidad_ruedas)
    SELECT c.id, ?, ?, ?, ?, ?
    FROM torneos_categorias c
    WHERE c.id = ? AND c.id_torneo_fk = ? AND c.activo = 1
`, [
    fase.nombre,
    fase.tipo,
    fase.formato,
    fase.orden,
    fase.cantidad_ruedas,
    fase.id_torneo_categoria_fk,
    fase.id_torneo_fk
])

exports.updateFase = fase => queryMYSQL(`
    UPDATE fases f
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    SET f.id_torneo_categoria_fk = ?, f.nombre = ?, f.tipo = ?, f.formato = ?,
        f.orden = ?, f.cantidad_ruedas = ?
    WHERE f.id = ? AND c.id_torneo_fk = ? AND f.activo = 1 AND c.activo = 1
        AND EXISTS (
            SELECT 1
            FROM torneos_categorias destino
            WHERE destino.id = ? AND destino.id_torneo_fk = ? AND destino.activo = 1
        )
        AND NOT EXISTS (
            SELECT 1
            FROM grupos g
            INNER JOIN grupos_equipos ge ON ge.id_grupo_fk = g.id AND ge.activo = 1
            INNER JOIN torneos_equipos te ON te.id = ge.id_torneo_equipo_fk AND te.activo = 1
            WHERE g.id_fase_fk = f.id AND te.id_torneo_categoria_fk <> ?
        )
`, [
    fase.id_torneo_categoria_fk,
    fase.nombre,
    fase.tipo,
    fase.formato,
    fase.orden,
    fase.cantidad_ruedas,
    fase.id,
    fase.id_torneo_fk,
    fase.id_torneo_categoria_fk,
    fase.id_torneo_fk,
    fase.id_torneo_categoria_fk
])

exports.deleteFase = (id, torneoId) => queryMYSQL(`
    UPDATE fases f
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    SET f.activo = 0
    WHERE f.id = ? AND c.id_torneo_fk = ? AND f.activo = 1
`, [id, torneoId])

exports.getFase = (id, torneoId) => queryMYSQL(`
    SELECT f.id, f.id_torneo_categoria_fk, f.nombre, f.tipo, f.formato, f.orden, f.cantidad_ruedas
    FROM fases f
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    WHERE f.id = ? AND c.id_torneo_fk = ? AND f.activo = 1 AND c.activo = 1
`, [id, torneoId])

exports.insertGrupo = grupo => queryMYSQL(`
    INSERT INTO grupos (id_fase_fk, nombre, orden)
    SELECT f.id, ?, ?
    FROM fases f
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    WHERE f.id = ? AND c.id_torneo_fk = ? AND f.activo = 1 AND c.activo = 1
`, [grupo.nombre, grupo.orden, grupo.id_fase_fk, grupo.id_torneo_fk])

exports.getGrupoByNombre = (faseId, nombre) => queryMYSQL(`
    SELECT id, activo
    FROM grupos
    WHERE id_fase_fk = ? AND nombre = ?
`, [faseId, nombre])

exports.reactivarGrupo = grupo => queryMYSQL(`
    UPDATE grupos g
    INNER JOIN fases f ON f.id = g.id_fase_fk
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    SET g.nombre = ?, g.orden = ?, g.activo = 1
    WHERE g.id = ? AND f.id = ? AND c.id_torneo_fk = ? AND f.activo = 1 AND c.activo = 1
`, [grupo.nombre, grupo.orden, grupo.id, grupo.id_fase_fk, grupo.id_torneo_fk])

exports.updateGrupo = grupo => queryMYSQL(`
    UPDATE grupos g
    INNER JOIN fases f ON f.id = g.id_fase_fk
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    SET g.id_fase_fk = ?, g.nombre = ?, g.orden = ?
    WHERE g.id = ? AND c.id_torneo_fk = ? AND g.activo = 1 AND f.activo = 1 AND c.activo = 1
        AND EXISTS (
            SELECT 1
            FROM fases destino
            INNER JOIN torneos_categorias destino_categoria
                ON destino_categoria.id = destino.id_torneo_categoria_fk
            WHERE destino.id = ? AND destino_categoria.id_torneo_fk = ?
                AND destino.activo = 1 AND destino_categoria.activo = 1
        )
        AND NOT EXISTS (
            SELECT 1
            FROM grupos_equipos ge
            INNER JOIN torneos_equipos te ON te.id = ge.id_torneo_equipo_fk AND te.activo = 1
            INNER JOIN fases destino ON destino.id = ?
            WHERE ge.id_grupo_fk = g.id AND ge.activo = 1
                AND te.id_torneo_categoria_fk <> destino.id_torneo_categoria_fk
        )
`, [
    grupo.id_fase_fk,
    grupo.nombre,
    grupo.orden,
    grupo.id,
    grupo.id_torneo_fk,
    grupo.id_fase_fk,
    grupo.id_torneo_fk,
    grupo.id_fase_fk
])

exports.deleteGrupo = (id, torneoId) => queryMYSQL(`
    UPDATE grupos g
    INNER JOIN fases f ON f.id = g.id_fase_fk
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    SET g.activo = 0
    WHERE g.id = ? AND c.id_torneo_fk = ? AND g.activo = 1
`, [id, torneoId])

exports.getGrupo = (id, torneoId) => queryMYSQL(`
    SELECT g.id, g.id_fase_fk, g.nombre, g.orden
    FROM grupos g
    INNER JOIN fases f ON f.id = g.id_fase_fk
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    WHERE g.id = ? AND c.id_torneo_fk = ? AND g.activo = 1
`, [id, torneoId])

exports.getGrupoAndInscripcion = (grupoId, inscripcionId, torneoId) => queryMYSQL(`
    SELECT g.id AS grupo_id, te.id AS inscripcion_id
    FROM grupos g
    INNER JOIN fases f ON f.id = g.id_fase_fk
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    INNER JOIN torneos_equipos te ON te.id_torneo_categoria_fk = c.id
    WHERE g.id = ? AND te.id = ? AND c.id_torneo_fk = ?
        AND g.activo = 1 AND f.activo = 1 AND c.activo = 1 AND te.activo = 1
`, [grupoId, inscripcionId, torneoId])

exports.getGrupoInscripcionPair = (grupoId, inscripcionId) => queryMYSQL(`
    SELECT id, activo
    FROM grupos_equipos
    WHERE id_grupo_fk = ? AND id_torneo_equipo_fk = ?
`, [grupoId, inscripcionId])

exports.getGrupoEquipo = (id, torneoId) => queryMYSQL(`
    SELECT ge.id
    FROM grupos_equipos ge
    INNER JOIN grupos g ON g.id = ge.id_grupo_fk
    INNER JOIN fases f ON f.id = g.id_fase_fk
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    WHERE ge.id = ? AND c.id_torneo_fk = ? AND ge.activo = 1
`, [id, torneoId])

exports.insertGrupoEquipo = (grupoId, inscripcionId, orden, torneoId) => queryMYSQL(`
    INSERT INTO grupos_equipos (id_grupo_fk, id_torneo_equipo_fk, orden)
    SELECT g.id, te.id, ?
    FROM grupos g
    INNER JOIN fases f ON f.id = g.id_fase_fk
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    INNER JOIN torneos_equipos te ON te.id_torneo_categoria_fk = c.id
    WHERE g.id = ? AND te.id = ? AND c.id_torneo_fk = ?
        AND g.activo = 1 AND f.activo = 1 AND c.activo = 1 AND te.activo = 1
`, [orden, grupoId, inscripcionId, torneoId])

exports.reactivarGrupoEquipo = (grupoId, inscripcionId, orden) => queryMYSQL(`
    UPDATE grupos_equipos
    SET activo = 1, orden = ?
    WHERE id_grupo_fk = ? AND id_torneo_equipo_fk = ?
`, [orden, grupoId, inscripcionId])

exports.deleteGrupoEquipo = (id, torneoId) => queryMYSQL(`
    UPDATE grupos_equipos ge
    INNER JOIN grupos g ON g.id = ge.id_grupo_fk
    INNER JOIN fases f ON f.id = g.id_fase_fk
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    SET ge.activo = 0
    WHERE ge.id = ? AND c.id_torneo_fk = ? AND ge.activo = 1
`, [id, torneoId])
