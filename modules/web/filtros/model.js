const { queryMYSQL } = require("../../../database")

exports.getCompetenciasYCategorias = async () => {
    const filas = await queryMYSQL(`
        SELECT
            t.id AS idTorneo,
            t.nombre AS torneo,
            t.temporada,
            tipo.nombre AS tipoCompetencia,
            tc.id AS idCategoria,
            tc.nombre AS categoria,
            tc.rama
        FROM torneos t
        INNER JOIN tipos_competencia tipo ON tipo.id = t.id_tipo_competencia_fk
        INNER JOIN torneos_categorias tc ON tc.id_torneo_fk = t.id
        WHERE t.activo = 1
            AND tipo.activo = 1
            AND tc.activo = 1
        ORDER BY t.temporada DESC, tipo.nombre, t.nombre, tc.orden, tc.nombre
    `, [])

    const competencias = new Map()
    const categorias = filas.map(fila => {
        if (!competencias.has(fila.idTorneo)) {
            competencias.set(fila.idTorneo, {
                id: fila.idTorneo,
                nombre: fila.torneo,
                temporada: fila.temporada,
                tipo: fila.tipoCompetencia
            })
        }
        return {
            id: fila.idCategoria,
            idTorneo: fila.idTorneo,
            nombre: fila.categoria,
            rama: fila.rama
        }
    })

    return {
        competencias: Array.from(competencias.values()),
        categorias
    }
}
