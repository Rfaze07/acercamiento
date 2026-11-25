const { queryMYSQL, getConnectionMYSQL } = require("../../database")

const queryConnection = (connection, sql, params = []) => new Promise((resolve, reject) => {
    connection.query(sql, params, (error, rows) => {
        if (error) reject(error)
        else resolve(rows)
    })
})

const transaction = action => new Promise((resolve, reject) => {
    const pool = getConnectionMYSQL()
    pool.getConnection((connectionError, connection) => {
        if (connectionError) return reject(connectionError)
        connection.beginTransaction(async beginError => {
            if (beginError) {
                connection.release()
                return reject(beginError)
            }
            try {
                const result = await action(connection)
                connection.commit(commitError => {
                    if (commitError) {
                        return connection.rollback(() => {
                            connection.release()
                            reject(commitError)
                        })
                    }
                    connection.release()
                    resolve(result)
                })
            } catch (error) {
                connection.rollback(() => {
                    connection.release()
                    reject(error)
                })
            }
        })
    })
})

const errorOperacion = (code, message) => {
    const error = new Error(message)
    error.code = code
    return error
}

const consultaOpcionesPlantel = (partido, connection) => {
    if (Number(partido.id_torneo_categoria_fk)) {
        const sql = `
            SELECT tej.id AS id_torneo_equipo_jugador_fk, j.id AS id_jugador_fk,
                j.nombre, tej.dorsal, te.id_equipo_fk,
                CASE WHEN te.id_equipo_fk = p.id_equipoA_fk THEN 'A' ELSE 'B' END AS lado
            FROM partidos p
            INNER JOIN torneos_equipos te
                ON te.id_torneo_categoria_fk = p.id_torneo_categoria_fk
                AND te.id_equipo_fk IN (p.id_equipoA_fk, p.id_equipoB_fk)
                AND te.estado = 'confirmado' AND te.activo = 1
            INNER JOIN torneos_equipos_jugadores tej
                ON tej.id_torneo_equipo_fk = te.id AND tej.estado = 'activo'
            INNER JOIN jugadores j ON j.id = tej.id_jugador_fk AND j.activo = 1
            WHERE p.id = ?
            ORDER BY lado, tej.dorsal, j.nombre
        `
        return connection
            ? queryConnection(connection, sql, [partido.id])
            : queryMYSQL(sql, [partido.id])
    }

    const sql = `
        SELECT NULL AS id_torneo_equipo_jugador_fk, j.id AS id_jugador_fk,
            j.nombre, j.dorsal, j.id_equipo_fk,
            CASE WHEN j.id_equipo_fk = p.id_equipoA_fk THEN 'A' ELSE 'B' END AS lado
        FROM partidos p
        INNER JOIN jugadores j
            ON j.id_equipo_fk IN (p.id_equipoA_fk, p.id_equipoB_fk) AND j.activo = 1
        WHERE p.id = ?
        ORDER BY lado, j.dorsal, j.nombre
    `
    return connection
        ? queryConnection(connection, sql, [partido.id])
        : queryMYSQL(sql, [partido.id])
}


exports.execQuery = (query, params) => {
    return queryMYSQL(query, params)
}

exports.getAll = () => {
	return queryMYSQL(`
        SELECT p.*, eA.nombre as equipoA, eB.nombre as equipoB,
            c.id_torneo_fk, c.nombre AS categoria, t.nombre AS torneo,
            t.temporada, f.nombre AS fase
        FROM partidos p
        LEFT JOIN equipos eA ON p.id_equipoA_fk = eA.id
        LEFT JOIN equipos eB ON p.id_equipoB_fk = eB.id
        LEFT JOIN torneos_categorias c ON c.id = p.id_torneo_categoria_fk
        LEFT JOIN torneos t ON t.id = c.id_torneo_fk
        LEFT JOIN fases f ON f.id = p.id_fase_fk AND f.id_torneo_categoria_fk = c.id
        ORDER BY p.fecha_hora DESC
    `, [])
}


exports.getById = id => {
	return queryMYSQL(`
        SELECT p.*, eA.nombre as equipoA, eB.nombre as equipoB, c.id_torneo_fk
        FROM partidos p
        LEFT JOIN equipos eA ON p.id_equipoA_fk = eA.id
        LEFT JOIN equipos eB ON p.id_equipoB_fk = eB.id
        LEFT JOIN torneos_categorias c ON c.id = p.id_torneo_categoria_fk
        WHERE p.id = ?
    `, [id])
}



exports.insert = o => {
    return queryMYSQL(`
        INSERT INTO partidos (fecha_hora, id_equipoA_fk, id_equipoB_fk, id_torneo_categoria_fk, id_fase_fk)
        VALUES (?, ?, ?, ?, ?)
    `, [o.fecha_hora, o.id_equipoA_fk, o.id_equipoB_fk, o.id_torneo_categoria_fk, o.id_fase_fk])
}

exports.update = o => {
    return queryMYSQL(`
        UPDATE partidos 
        SET fecha_hora=?, id_equipoA_fk=?, id_equipoB_fk=?, id_torneo_categoria_fk=?, id_fase_fk=?
        WHERE id=?
    `, [o.fecha_hora, o.id_equipoA_fk, o.id_equipoB_fk, o.id_torneo_categoria_fk, o.id_fase_fk, o.id])
}

exports.delete = async id => {
    return queryMYSQL(`
        DELETE FROM partidos 
        WHERE id = ?
    `, [id])
}

exports.updateEstado = (id, estado, puntosA, puntosB) => {
    return queryMYSQL(`
        UPDATE partidos
        SET estado=?, puntosA=?, puntosB=?
        WHERE id=?
    `, [estado, puntosA, puntosB, id])
}

exports.updatePuntos = (id, puntosA, puntosB) => {
    return queryMYSQL(`
        UPDATE partidos
        SET puntosA=?, puntosB=?
        WHERE id=?
    `, [puntosA, puntosB, id])
}


exports.insertarEvento = (o) => {
    return queryMYSQL(`
        INSERT INTO eventos_partido (id_partido_fk, id_jugador_fk, evento, valor, periodo, tiempo_restante, fecha_hora) 
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [o.id_partido_fk, o.id_jugador_fk, o.evento, o.valor, o.periodo, o.tiempo_restante])
}

exports.registrarEstadistica = (o) => transaction(async connection => {
    const partidos = await queryConnection(connection, `
        SELECT id, estado, id_equipoA_fk, id_equipoB_fk, id_torneo_categoria_fk
        FROM partidos
        WHERE id = ?
        FOR UPDATE
    `, [o.id_partido_fk])
    if (!partidos.length) throw errorOperacion("PARTIDO_NO_EXISTE", "El partido solicitado no existe")
    if (Number(partidos[0].estado) !== 1) {
        throw errorOperacion("PARTIDO_NO_EN_CURSO", "Las estadísticas solo se pueden registrar durante un partido en curso")
    }

    let convocados = await queryConnection(connection, `
        SELECT id_jugador_fk, lado, es_titular
        FROM partidos_jugadores
        WHERE id_partido_fk = ?
        FOR UPDATE
    `, [o.id_partido_fk])
    const esPartidoLegado = !convocados.length && !Number(partidos[0].id_torneo_categoria_fk)
    if (esPartidoLegado) {
        const candidatos = await consultaOpcionesPlantel(partidos[0], connection)
        convocados = candidatos.map(jugador => ({ ...jugador, es_titular: 1 }))
    }
    const jugador = convocados.find(convocado => Number(convocado.id_jugador_fk) === Number(o.id_jugador_fk))
    if (!jugador) throw errorOperacion("JUGADOR_NO_CONVOCADO", "Solo se pueden registrar estadísticas de jugadores convocados")

    const eventos = await queryConnection(connection, `
        SELECT id_jugador_fk, valor
        FROM eventos_partido
        WHERE id_partido_fk = ? AND evento = 'sustitucion'
        ORDER BY id
        FOR UPDATE
    `, [o.id_partido_fk])
    const enCancha = new Set(convocados
        .filter(convocado => convocado.lado === jugador.lado && Number(convocado.es_titular) === 1)
        .map(convocado => Number(convocado.id_jugador_fk)))
    for (const evento of eventos) {
        const sale = Number(evento.id_jugador_fk)
        const entra = Number(evento.valor)
        if (enCancha.has(sale)) {
            enCancha.delete(sale)
            enCancha.add(entra)
        }
    }
    if (!enCancha.has(Number(o.id_jugador_fk))) {
        throw errorOperacion("JUGADOR_EN_BANCO", "Para registrar estadísticas, el jugador debe estar en cancha")
    }
    return queryConnection(connection, `
        INSERT INTO eventos_partido
            (id_partido_fk, id_jugador_fk, evento, valor, periodo, tiempo_restante, fecha_hora)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [o.id_partido_fk, o.id_jugador_fk, o.evento, o.valor, o.periodo, o.tiempo_restante])
})

exports.deshacerUltimoEvento = (id_partido_fk) => {
    return queryMYSQL(`
        DELETE FROM eventos_partido
        WHERE id_partido_fk = ?
        ORDER BY id DESC
        LIMIT 1
    `, [id_partido_fk])
}

exports.getEventosByPartido = (id_partido_fk) => {
    return queryMYSQL(`
        SELECT ep.*, j.nombre AS jugador, j_entrada.nombre AS jugador_entrada,
            e.nombre AS equipo,
            CASE
                WHEN COALESCE(pj.id_equipo_fk, j.id_equipo_fk) = p.id_equipoA_fk THEN 'A'
                WHEN COALESCE(pj.id_equipo_fk, j.id_equipo_fk) = p.id_equipoB_fk THEN 'B'
                ELSE NULL
            END AS lado
        FROM eventos_partido ep
        INNER JOIN partidos p ON p.id = ep.id_partido_fk
        LEFT JOIN jugadores j ON ep.id_jugador_fk = j.id
        LEFT JOIN jugadores j_entrada
            ON ep.evento = 'sustitucion' AND j_entrada.id = ep.valor
        LEFT JOIN partidos_jugadores pj
            ON pj.id_partido_fk = ep.id_partido_fk AND pj.id_jugador_fk = ep.id_jugador_fk
        LEFT JOIN equipos e ON e.id = COALESCE(pj.id_equipo_fk, j.id_equipo_fk)
        WHERE ep.id_partido_fk = ?
        ORDER BY ep.id ASC
    `, [id_partido_fk])
}

exports.getCategoriasParaPartido = () => queryMYSQL(`
    SELECT c.id, c.nombre, t.nombre AS torneo, t.temporada
    FROM torneos_categorias c
    INNER JOIN torneos t ON t.id = c.id_torneo_fk
    WHERE c.activo = 1 AND t.activo = 1
    ORDER BY t.temporada DESC, t.nombre, c.orden, c.nombre
`, [])

exports.getOpcionesClasificacion = async () => {
    const [torneos, categorias, fases] = await Promise.all([
        queryMYSQL(`
            SELECT id, nombre, temporada
            FROM torneos
            WHERE activo = 1
            ORDER BY temporada DESC, nombre
        `, []),
        queryMYSQL(`
            SELECT c.id, c.id_torneo_fk, c.nombre, t.nombre AS torneo, t.temporada
            FROM torneos_categorias c
            INNER JOIN torneos t ON t.id = c.id_torneo_fk
            WHERE c.activo = 1 AND t.activo = 1
            ORDER BY t.temporada DESC, t.nombre, c.orden, c.nombre
        `, []),
        queryMYSQL(`
            SELECT f.id, f.id_torneo_categoria_fk, f.nombre, f.tipo, f.orden
            FROM fases f
            INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
            INNER JOIN torneos t ON t.id = c.id_torneo_fk
            WHERE f.activo = 1 AND c.activo = 1 AND t.activo = 1
            ORDER BY t.temporada DESC, t.nombre, c.orden, c.nombre, f.orden, f.nombre
        `, [])
    ])
    return { torneos, categorias, fases }
}

exports.getEquiposPorCategoria = categoriaId => queryMYSQL(`
    SELECT te.id_equipo_fk AS id, e.nombre,
        COALESCE(te.nombre_inscripcion, e.nombre) AS nombre_inscripcion
    FROM torneos_equipos te
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    INNER JOIN torneos t ON t.id = c.id_torneo_fk
    INNER JOIN equipos e ON e.id = te.id_equipo_fk
    WHERE c.id = ? AND c.activo = 1 AND t.activo = 1
        AND te.activo = 1 AND te.estado = 'confirmado' AND e.activo = 1
    ORDER BY e.nombre
`, [categoriaId])

exports.validarEquiposCategoria = (categoriaId, equipoA, equipoB) => queryMYSQL(`
    SELECT COUNT(DISTINCT te.id_equipo_fk) AS cantidad, MAX(c.id_torneo_fk) AS id_torneo_fk
    FROM torneos_equipos te
    INNER JOIN torneos_categorias c ON c.id = te.id_torneo_categoria_fk
    WHERE c.id = ? AND c.activo = 1 AND te.activo = 1 AND te.estado = 'confirmado'
        AND te.id_equipo_fk IN (?, ?)
`, [categoriaId, equipoA, equipoB])

exports.validarFaseCategoria = (faseId, categoriaId) => queryMYSQL(`
    SELECT COUNT(*) AS cantidad
    FROM fases f
    INNER JOIN torneos_categorias c ON c.id = f.id_torneo_categoria_fk
    INNER JOIN torneos t ON t.id = c.id_torneo_fk
    WHERE f.id = ? AND f.id_torneo_categoria_fk = ? AND f.activo = 1
        AND c.activo = 1 AND t.activo = 1
`, [faseId, categoriaId])

exports.getConvocatoriaData = async partidoId => {
    const partido = await exports.getById(partidoId)
    if (!partido.length) return null
    const [candidatos, convocados, sustituciones] = await Promise.all([
        consultaOpcionesPlantel(partido[0]),
        queryMYSQL(`
            SELECT pj.*, j.nombre
            FROM partidos_jugadores pj
            INNER JOIN jugadores j ON j.id = pj.id_jugador_fk
            WHERE pj.id_partido_fk = ?
            ORDER BY pj.lado, pj.es_titular DESC, pj.dorsal, j.nombre
        `, [partidoId]),
        queryMYSQL(`
            SELECT id, id_jugador_fk, valor AS id_jugador_entrada, periodo, tiempo_restante
            FROM eventos_partido
            WHERE id_partido_fk = ? AND evento = 'sustitucion'
            ORDER BY id
        `, [partidoId])
    ])
    return { partido: partido[0], candidatos, convocados, sustituciones }
}

exports.guardarConvocatoria = (partidoId, seleccion) => transaction(async connection => {
    const partidos = await queryConnection(connection, `
        SELECT id, estado, id_equipoA_fk, id_equipoB_fk, id_torneo_categoria_fk
        FROM partidos
        WHERE id = ?
        FOR UPDATE
    `, [partidoId])
    if (!partidos.length) throw errorOperacion("PARTIDO_NO_EXISTE", "El partido solicitado no existe")
    if (Number(partidos[0].estado) !== 0) throw errorOperacion("PARTIDO_INICIADO", "No se puede modificar la convocatoria después de iniciar el partido")
    const eventos = await queryConnection(connection, `
        SELECT id FROM eventos_partido
        WHERE id_partido_fk = ? AND evento = 'sustitucion'
        LIMIT 1
    `, [partidoId])
    if (eventos.length) throw errorOperacion("PARTIDO_CON_EVENTOS", "La convocatoria no se puede cambiar después de registrar sustituciones")

    const opciones = await consultaOpcionesPlantel(partidos[0], connection)
    const opcionesPorJugador = new Map(opciones.map(opcion => [Number(opcion.id_jugador_fk), opcion]))
    const idsVistos = new Set()
    const titulares = { A: 0, B: 0 }
    const filas = []
    for (const jugador of seleccion) {
        const jugadorId = Number(jugador.id_jugador_fk)
        const opcion = opcionesPorJugador.get(jugadorId)
        if (!Number.isInteger(jugadorId) || !opcion || opcion.lado !== jugador.lado || idsVistos.has(jugadorId)) {
            throw errorOperacion("CONVOCATORIA_INVALIDA", "La convocatoria contiene jugadores que no pertenecen a los planteles de este partido")
        }
        idsVistos.add(jugadorId)
        const titular = jugador.es_titular === true || jugador.es_titular === 1 || jugador.es_titular === "1"
        if (titular) titulares[jugador.lado]++
        filas.push({
            id_jugador_fk: jugadorId,
            id_equipo_fk: Number(opcion.id_equipo_fk),
            id_torneo_equipo_jugador_fk: opcion.id_torneo_equipo_jugador_fk,
            lado: jugador.lado,
            dorsal: opcion.dorsal,
            es_titular: titular ? 1 : 0
        })
    }
    if (titulares.A !== 5 || titulares.B !== 5) {
        throw errorOperacion("TITULARES_INVALIDOS", "Debe seleccionar exactamente cinco titulares por equipo")
    }

    await queryConnection(connection, "DELETE FROM partidos_jugadores WHERE id_partido_fk = ?", [partidoId])
    const placeholders = filas.map(() => "(?, ?, ?, ?, ?, ?, ?, 0)").join(", ")
    const valores = filas.flatMap(jugador => [
        partidoId,
        jugador.id_jugador_fk,
        jugador.id_equipo_fk,
        jugador.id_torneo_equipo_jugador_fk,
        jugador.lado,
        jugador.dorsal,
        jugador.es_titular
    ])
    const resultado = await queryConnection(connection, `
        INSERT INTO partidos_jugadores
            (id_partido_fk, id_jugador_fk, id_equipo_fk, id_torneo_equipo_jugador_fk,
             lado, dorsal, es_titular, ingreso)
        VALUES ${placeholders}
    `, valores)
    return { affectedRows: resultado.affectedRows, convocados: filas.length }
})

exports.getConvocatoriaActual = partidoId => queryMYSQL(`
    SELECT id, id_jugador_fk, id_equipo_fk, id_torneo_equipo_jugador_fk, lado,
        dorsal, es_titular
    FROM partidos_jugadores
    WHERE id_partido_fk = ?
    ORDER BY lado, es_titular DESC, dorsal, id_jugador_fk
`, [partidoId])

exports.registrarSustitucion = (partidoId, saleId, entraId, periodo, tiempoRestante) => transaction(async connection => {
    const partidos = await queryConnection(connection, `
        SELECT id, estado FROM partidos WHERE id = ? FOR UPDATE
    `, [partidoId])
    if (!partidos.length) throw errorOperacion("PARTIDO_NO_EXISTE", "El partido solicitado no existe")
    if (Number(partidos[0].estado) !== 1) throw errorOperacion("PARTIDO_NO_EN_CURSO", "Las sustituciones solo se pueden registrar durante un partido en curso")

    const convocados = await queryConnection(connection, `
        SELECT id_jugador_fk, lado, es_titular
        FROM partidos_jugadores
        WHERE id_partido_fk = ?
        FOR UPDATE
    `, [partidoId])
    const jugadores = new Map(convocados.map(jugador => [Number(jugador.id_jugador_fk), jugador]))
    const jugadorSale = jugadores.get(saleId)
    const jugadorEntra = jugadores.get(entraId)
    if (!jugadorSale || !jugadorEntra || jugadorSale.lado !== jugadorEntra.lado || saleId === entraId) {
        throw errorOperacion("SUSTITUCION_INVALIDA", "Los jugadores deben pertenecer al mismo equipo y estar convocados")
    }

    const eventos = await queryConnection(connection, `
        SELECT id_jugador_fk, valor
        FROM eventos_partido
        WHERE id_partido_fk = ? AND evento = 'sustitucion'
        ORDER BY id
        FOR UPDATE
    `, [partidoId])
    const enCancha = new Set(convocados
        .filter(jugador => jugador.lado === jugadorSale.lado && Number(jugador.es_titular) === 1)
        .map(jugador => Number(jugador.id_jugador_fk)))
    for (const evento of eventos) {
        const sale = Number(evento.id_jugador_fk)
        const entra = Number(evento.valor)
        if (enCancha.has(sale)) {
            enCancha.delete(sale)
            enCancha.add(entra)
        }
    }
    if (!enCancha.has(saleId) || enCancha.has(entraId)) {
        throw errorOperacion("ESTADO_SUSTITUCION_INVALIDO", "El jugador que sale debe estar en cancha y el que entra debe estar en el banco")
    }

    return queryConnection(connection, `
        INSERT INTO eventos_partido
            (id_partido_fk, id_jugador_fk, evento, valor, periodo, tiempo_restante, fecha_hora)
        VALUES (?, ?, 'sustitucion', ?, ?, ?, NOW())
    `, [partidoId, saleId, entraId, periodo, tiempoRestante])
})

exports.getJugadorConvocado = (partidoId, jugadorId) => queryMYSQL(`
    SELECT id_jugador_fk, lado, es_titular
    FROM partidos_jugadores
    WHERE id_partido_fk = ? AND id_jugador_fk = ?
`, [partidoId, jugadorId])
