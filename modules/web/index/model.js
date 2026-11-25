const { queryMYSQL } = require("../../../database")

const consultaPartidos = (condicion, orden, limite = "") => queryMYSQL(`
    SELECT p.id,
        DATE_FORMAT(p.fecha_hora, '%Y-%m-%d') AS fechaPartido,
        TIME_FORMAT(p.fecha_hora, '%H:%i') AS horaPartido,
        p.estado, eA.nombre AS equipoA, eB.nombre AS equipoB,
        c.nombre AS categoria, t.nombre AS torneo, t.temporada,
        tipo.nombre AS tipoCompetencia, f.nombre AS fase,
        CASE
            WHEN p.estado = 1 THEN COALESCE(marcador.puntosA, 0)
            ELSE COALESCE(NULLIF(p.puntosA, 0), marcador.puntosA, 0)
        END AS puntosEquipoA,
        CASE
            WHEN p.estado = 1 THEN COALESCE(marcador.puntosB, 0)
            ELSE COALESCE(NULLIF(p.puntosB, 0), marcador.puntosB, 0)
        END AS puntosEquipoB,
        marcador.periodoActual
    FROM partidos p
    LEFT JOIN equipos eA ON eA.id = p.id_equipoA_fk
    LEFT JOIN equipos eB ON eB.id = p.id_equipoB_fk
    LEFT JOIN torneos_categorias c ON c.id = p.id_torneo_categoria_fk
    LEFT JOIN torneos t ON t.id = c.id_torneo_fk
    LEFT JOIN tipos_competencia tipo ON tipo.id = t.id_tipo_competencia_fk
    LEFT JOIN fases f ON f.id = p.id_fase_fk AND f.id_torneo_categoria_fk = c.id
    LEFT JOIN (
        SELECT ep.id_partido_fk,
            SUM(CASE WHEN ep.evento = 'puntos'
                AND COALESCE(pj.id_equipo_fk, j.id_equipo_fk) = partido.id_equipoA_fk
                THEN ep.valor ELSE 0 END) AS puntosA,
            SUM(CASE WHEN ep.evento = 'puntos'
                AND COALESCE(pj.id_equipo_fk, j.id_equipo_fk) = partido.id_equipoB_fk
                THEN ep.valor ELSE 0 END) AS puntosB,
            MAX(ep.periodo) AS periodoActual
        FROM eventos_partido ep
        INNER JOIN partidos partido ON partido.id = ep.id_partido_fk
        LEFT JOIN jugadores j ON j.id = ep.id_jugador_fk
        LEFT JOIN partidos_jugadores pj
            ON pj.id_partido_fk = ep.id_partido_fk AND pj.id_jugador_fk = ep.id_jugador_fk
        GROUP BY ep.id_partido_fk
    ) marcador ON marcador.id_partido_fk = p.id
    WHERE ${condicion}
    ORDER BY ${orden}
    ${limite}
`, [])

exports.getPartidosEnVivo = () => consultaPartidos("p.estado = 1", "p.fecha_hora ASC, p.id ASC")

exports.getUltimosPartidos = () => consultaPartidos("p.estado = 2", "p.fecha_hora DESC, p.id DESC", "LIMIT 2")

exports.getProximosPartidos = () => consultaPartidos(
    "p.estado = 0 AND p.fecha_hora >= NOW()",
    "p.fecha_hora ASC, p.id ASC",
    "LIMIT 3"
)

exports.getResumen = () => queryMYSQL(`
    SELECT
        (SELECT COUNT(*) FROM torneos t
            WHERE t.activo = 1 AND t.estado IN ('planificacion', 'inscripcion', 'en_curso')) AS torneosActivos,
        (SELECT COUNT(DISTINCT te.id_equipo_fk)
            FROM torneos_equipos te
            INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
            INNER JOIN torneos t ON t.id = c.id_torneo_fk
            WHERE te.activo = 1 AND te.estado = 'confirmado'
                AND c.activo = 1 AND t.activo = 1) AS equiposInscritos,
        (SELECT COUNT(*) FROM partidos p WHERE p.estado = 2) AS partidosFinalizados
`, [])