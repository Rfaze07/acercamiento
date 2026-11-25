const { queryMYSQL } = require("../../database")

exports.getAll = activo => {
    let sql = `
        SELECT tc.*
        FROM tipos_competencia tc
        WHERE 1 = 1
    `
    const params = []
    if (activo !== "t") {
        sql += " AND tc.activo = ?"
        params.push(activo)
    }
    sql += " ORDER BY tc.nombre"
    return queryMYSQL(sql, params)
}

exports.getById = id => queryMYSQL(`
    SELECT tc.*
    FROM tipos_competencia tc
    WHERE tc.id = ?
`, [id])

exports.insert = tipo => queryMYSQL(`
    INSERT INTO tipos_competencia (nombre, descripcion)
    VALUES (?, ?)
`, [tipo.nombre, tipo.descripcion])

exports.update = tipo => queryMYSQL(`
    UPDATE tipos_competencia
    SET nombre = ?, descripcion = ?, activo = ?
    WHERE id = ?
`, [tipo.nombre, tipo.descripcion, tipo.activo, tipo.id])

exports.delete = id => queryMYSQL(`
    UPDATE tipos_competencia
    SET activo = 0
    WHERE id = ?
`, [id])
