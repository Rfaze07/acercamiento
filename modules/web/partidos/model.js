const { queryMYSQL } = require("../../../database")


exports.execQuery = (query, params) => {
    return queryMYSQL(query, params)
}

exports.getAll = (idTorneo, idCategoria) => {
    let filtro = ""
    const parametros = []
    if (idTorneo !== undefined && idCategoria !== undefined) {
        filtro = " WHERE t.id = ? AND tc.id = ?"
        parametros.push(idTorneo, idCategoria)
    }

    return queryMYSQL(`
       SELECT 
            p.*,
            eA.nombre AS equipoA,
            eB.nombre AS equipoB,
            tc.nombre AS categoria,
            t.nombre AS torneo,
            t.temporada,
            tipo.nombre AS tipoCompetencia,
            f.nombre AS fase,
            g.nombre AS grupo,
            DATE_FORMAT(p.fecha_hora, '%Y-%m-%d') AS fechaPartido,
            TIME_FORMAT(p.fecha_hora, '%H:%i') AS horaPartido,
            CASE WHEN EXISTS (
                SELECT 1 FROM partidos_jugadores pj
                WHERE pj.id_partido_fk = p.id
            ) THEN COALESCE((
                SELECT SUM(e.valor)
                FROM eventos_partido e
                INNER JOIN partidos_jugadores pj
                    ON pj.id_partido_fk = e.id_partido_fk
                    AND pj.id_jugador_fk = e.id_jugador_fk
                WHERE e.id_partido_fk = p.id
                    AND e.evento = 'puntos'
                    AND pj.id_equipo_fk = p.id_equipoA_fk
            ), 0) ELSE COALESCE((
                SELECT SUM(e.valor)
                FROM eventos_partido e
                INNER JOIN jugadores j ON j.id = e.id_jugador_fk
                WHERE e.id_partido_fk = p.id
                    AND e.evento = 'puntos'
                    AND j.id_equipo_fk = p.id_equipoA_fk
            ), 0) END AS puntosEquipoA,
            CASE WHEN EXISTS (
                SELECT 1 FROM partidos_jugadores pj
                WHERE pj.id_partido_fk = p.id
            ) THEN COALESCE((
                SELECT SUM(e.valor)
                FROM eventos_partido e
                INNER JOIN partidos_jugadores pj
                    ON pj.id_partido_fk = e.id_partido_fk
                    AND pj.id_jugador_fk = e.id_jugador_fk
                WHERE e.id_partido_fk = p.id
                    AND e.evento = 'puntos'
                    AND pj.id_equipo_fk = p.id_equipoB_fk
            ), 0) ELSE COALESCE((
                SELECT SUM(e.valor)
                FROM eventos_partido e
                INNER JOIN jugadores j ON j.id = e.id_jugador_fk
                WHERE e.id_partido_fk = p.id
                    AND e.evento = 'puntos'
                    AND j.id_equipo_fk = p.id_equipoB_fk
            ), 0) END AS puntosEquipoB,
            ( SELECT MAX(e.periodo)
              FROM eventos_partido e
              WHERE e.id_partido_fk = p.id
            ) AS periodoActual
        FROM partidos p	
        LEFT JOIN equipos eA ON p.id_equipoA_fk = eA.id
        LEFT JOIN equipos eB ON p.id_equipoB_fk = eB.id
        LEFT JOIN torneos_categorias tc ON tc.id = p.id_torneo_categoria_fk
        LEFT JOIN torneos t ON t.id = tc.id_torneo_fk
        LEFT JOIN tipos_competencia tipo ON tipo.id = t.id_tipo_competencia_fk
        LEFT JOIN fases f ON f.id = p.id_fase_fk
        LEFT JOIN grupos g ON g.id = p.id_grupo_fk
        ${filtro}
        ORDER BY p.fecha_hora ASC
    `, parametros)
}


exports.getById = (idPartido) => {
    return queryMYSQL(`
        SELECT p.*,
            eA.nombre AS equipoA,
            eB.nombre AS equipoB,
            tc.nombre AS categoria,
            t.nombre AS torneo,
            t.temporada,
            tipo.nombre AS tipoCompetencia,
            f.nombre AS fase,
            g.nombre AS grupo
        FROM partidos p
        LEFT JOIN equipos eA ON p.id_equipoA_fk = eA.id
        LEFT JOIN equipos eB ON p.id_equipoB_fk = eB.id
        LEFT JOIN torneos_categorias tc ON tc.id = p.id_torneo_categoria_fk
        LEFT JOIN torneos t ON t.id = tc.id_torneo_fk
        LEFT JOIN tipos_competencia tipo ON tipo.id = t.id_tipo_competencia_fk
        LEFT JOIN fases f ON f.id = p.id_fase_fk
        LEFT JOIN grupos g ON g.id = p.id_grupo_fk
        WHERE p.id = ?
    `, [idPartido])
}

exports.getEstadisticasPorPartido = (idPartido) => {
    return queryMYSQL(`
          SELECT 
            COALESCE(pj.dorsal, j.dorsal) AS dorsal,
            j.nombre,
            e.nombre AS equipo,
            COALESCE(pj.id_equipo_fk, j.id_equipo_fk) AS idEquipo,
            pj.lado,
            SUM(CASE WHEN ep.evento = 'puntos' AND ep.valor = 1 THEN 1 ELSE 0 END) AS TL,
            SUM(CASE WHEN ep.evento = 'puntos' AND ep.valor = 2 THEN 1 ELSE 0 END) AS T2,
            SUM(CASE WHEN ep.evento = 'puntos' AND ep.valor = 3 THEN 1 ELSE 0 END) AS T3,
            SUM(CASE WHEN ep.evento = 'rebotes' THEN 1 ELSE 0 END) AS REB,
            SUM(CASE WHEN ep.evento IN ('faltas', 'falta_tecnica', 'falta_antideportiva')
                THEN 1 ELSE 0 END) AS FAL,
            SUM(CASE WHEN ep.evento = 'asistencias' THEN 1 ELSE 0 END) AS AST,
            SUM(CASE WHEN ep.evento = 'puntos' THEN ep.valor ELSE 0 END) AS PTS,
            e.id AS idEquipo
        FROM partidos p
        INNER JOIN jugadores j ON (
            j.id_equipo_fk IN (p.id_equipoA_fk, p.id_equipoB_fk)
            OR EXISTS (
                SELECT 1
                FROM partidos_jugadores convocatoria
                WHERE convocatoria.id_partido_fk = p.id
                    AND convocatoria.id_jugador_fk = j.id
            )
        )
        LEFT JOIN partidos_jugadores pj
            ON pj.id_partido_fk = p.id
            AND pj.id_jugador_fk = j.id
        LEFT JOIN equipos e 
            ON e.id = COALESCE(pj.id_equipo_fk, j.id_equipo_fk)
        LEFT JOIN eventos_partido ep 
            ON ep.id_jugador_fk = j.id
            AND ep.id_partido_fk = p.id   -- 👈 filtra eventos del partido pero mantiene jugadores sin eventos
        WHERE p.id = ?
            AND COALESCE(pj.id_equipo_fk, j.id_equipo_fk)
                IN (p.id_equipoA_fk, p.id_equipoB_fk)
            AND (
                pj.id IS NOT NULL
                OR NOT EXISTS (
                    SELECT 1
                    FROM partidos_jugadores convocatoria
                    WHERE convocatoria.id_partido_fk = p.id
                )
            )
        GROUP BY 
            j.id,
            j.dorsal,
            pj.dorsal,
            j.nombre,
            e.nombre,
            e.id,
            pj.id_equipo_fk,
            pj.lado
        ORDER BY 
            e.nombre,
            COALESCE(pj.dorsal, j.dorsal),
            j.nombre
    `, [idPartido])
}

exports.getPeriodoActual = (idPartido) => {
    return queryMYSQL(`
        SELECT 
            MAX(ep.periodo) AS periodoActual
        FROM eventos_partido ep
        WHERE ep.id_partido_fk = ?
    `, [idPartido])
}
