const { queryMYSQL } = require("../../database")

exports.getAll = activo => {
    let sql = `
        SELECT c.*
        FROM clubes c
        WHERE 1 = 1
    `
    const params = []
    if (activo !== "t") {
        sql += " AND c.activo = ?"
        params.push(activo)
    }
    sql += " ORDER BY c.nombre"
    return queryMYSQL(sql, params)
}

exports.getById = id => queryMYSQL(`
    SELECT c.*
    FROM clubes c
    WHERE c.id = ?
`, [id])

exports.insert = club => queryMYSQL(`
    INSERT INTO clubes (nombre, localidad, escudo)
    VALUES (?, ?, ?)
`, [club.nombre, club.localidad, club.escudo])

exports.update = club => queryMYSQL(`
    UPDATE clubes
    SET nombre = ?, localidad = ?, escudo = ?, activo = ?
    WHERE id = ?
`, [club.nombre, club.localidad, club.escudo, club.activo, club.id])

exports.delete = id => queryMYSQL(`
    UPDATE clubes
    SET activo = 0
    WHERE id = ?
`, [id])
