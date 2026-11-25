const { queryMYSQL } = require("../../../database")


exports.execQuery = (query, params) => {
    return queryMYSQL(query, params)
}

exports.getAll = (idTorneo, idCategoria) => {
    return queryMYSQL(`
        SELECT
            te.id AS idTorneoEquipo,
            e.id AS idEquipo,
            COALESCE(te.nombre_inscripcion, e.nombre) AS nombreEquipo,
            t.nombre AS torneo,
            t.temporada,
            tipo.nombre AS tipoCompetencia,
            tc.nombre AS categoria,
            tc.rama,
            j.id AS idJugador,
            j.nombre AS nombreJugador,
            tej.dorsal
        FROM torneos_equipos te
        INNER JOIN torneos_categorias tc ON tc.id = te.id_torneo_categoria_fk
        INNER JOIN torneos t ON t.id = tc.id_torneo_fk
        INNER JOIN tipos_competencia tipo ON tipo.id = t.id_tipo_competencia_fk
        INNER JOIN equipos e ON e.id = te.id_equipo_fk
        LEFT JOIN torneos_equipos_jugadores tej
            ON tej.id_torneo_equipo_fk = te.id
            AND tej.estado = 'activo'
        LEFT JOIN jugadores j
            ON j.id = tej.id_jugador_fk
            AND j.activo = 1
        WHERE te.activo = 1
            AND te.estado = 'confirmado'
            AND tc.activo = 1
            AND t.activo = 1
            AND e.activo = 1
            AND t.id = ?
            AND tc.id = ?
        ORDER BY t.nombre, t.temporada, tc.orden, tc.nombre,
            nombreEquipo, tej.dorsal, j.nombre
    `, [idTorneo, idCategoria])
}