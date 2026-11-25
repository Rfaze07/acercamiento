const { queryMYSQL } = require("../../../database")

exports.execQuery = (query, params) => queryMYSQL(query, params)

const getLeaderboard = (eventFilter, aggregate, totalAlias, idTorneo, idCategoria) => queryMYSQL(`
    SELECT
        j.id AS idJugador,
        j.nombre AS jugador,
        COALESCE(te.nombre_inscripcion, e.nombre) AS equipo,
        tipo.nombre AS tipoCompetencia,
        t.nombre AS torneo,
        t.temporada,
        tc.nombre AS categoria,
        ${aggregate} AS ${totalAlias}
    FROM eventos_partido ep
    INNER JOIN partidos p ON p.id = ep.id_partido_fk
    INNER JOIN jugadores j ON j.id = ep.id_jugador_fk
    LEFT JOIN partidos_jugadores pj
        ON pj.id_partido_fk = ep.id_partido_fk
        AND pj.id_jugador_fk = ep.id_jugador_fk
    LEFT JOIN equipos e ON e.id = COALESCE(pj.id_equipo_fk, j.id_equipo_fk)
    LEFT JOIN torneos_categorias tc ON tc.id = p.id_torneo_categoria_fk
    LEFT JOIN torneos t ON t.id = tc.id_torneo_fk
    LEFT JOIN tipos_competencia tipo ON tipo.id = t.id_tipo_competencia_fk
    LEFT JOIN torneos_equipos te
        ON te.id_torneo_categoria_fk = tc.id
        AND te.id_equipo_fk = COALESCE(pj.id_equipo_fk, j.id_equipo_fk)
    WHERE ${eventFilter}
        AND t.id = ?
        AND tc.id = ?
    GROUP BY
        j.id,
        j.nombre,
        COALESCE(pj.id_equipo_fk, j.id_equipo_fk),
        COALESCE(te.nombre_inscripcion, e.nombre),
        e.id,
        te.id,
        t.id,
        t.nombre,
        t.temporada,
        tipo.id,
        tipo.nombre,
        tc.id,
        tc.nombre
    ORDER BY ${totalAlias} DESC, j.nombre ASC
    LIMIT 10
`, [idTorneo, idCategoria])

exports.getMayoresGoleadores = (idTorneo, idCategoria) => getLeaderboard(
    "ep.evento = 'puntos'",
    "SUM(ep.valor)",
    "puntosTotales",
    idTorneo,
    idCategoria
)

exports.getMayoresAsistidores = (idTorneo, idCategoria) => getLeaderboard(
    "ep.evento = 'asistencias'",
    "COUNT(*)",
    "asistenciasTotales",
    idTorneo,
    idCategoria
)

exports.getMayoresReboteadores = (idTorneo, idCategoria) => getLeaderboard(
    "ep.evento = 'rebotes'",
    "COUNT(*)",
    "rebotesTotales",
    idTorneo,
    idCategoria
)

exports.getMayoresPegadores = (idTorneo, idCategoria) => getLeaderboard(
    "ep.evento IN ('faltas', 'falta_tecnica', 'falta_antideportiva')",
    "COUNT(*)",
    "faltasTotales",
    idTorneo,
    idCategoria
)
