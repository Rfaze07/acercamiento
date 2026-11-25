const { queryMYSQL } = require("../../database")


exports.execQuery = (query, params) => {
    return queryMYSQL(query, params)
}

exports.getAll = () => {
	return queryMYSQL(`
        SELECT e.*, c.nombre AS club
        FROM equipos e
        LEFT JOIN clubes c ON c.id = e.id_club_fk
        ORDER BY e.nombre
    `, [])
}

exports.getAllbyActivo = a => {
	return queryMYSQL(`
        SELECT e.*, c.nombre AS club
        FROM equipos e
        LEFT JOIN clubes c ON c.id = e.id_club_fk
        WHERE e.activo = ?
        ORDER BY e.nombre
    `, [a])
}

exports.getById = id => {
	return queryMYSQL(`
        SELECT e.*, c.nombre AS club
        FROM equipos e 
        LEFT JOIN clubes c ON c.id = e.id_club_fk
        WHERE e.id = ?
    `, [id])
}

exports.getByDesc = async desc => {
    return queryMYSQL(`
        select e.*
        FROM equipos e 
        where e.nombre = ?
    `, [desc])
}

exports.insert = o => {
    return queryMYSQL(`
        INSERT INTO equipos (nombre, id_club_fk, escudo)
        VALUES (?, ?, ?)
    `, [o.nombre, o.id_club_fk, o.escudo])
}

exports.update = o => {
    return queryMYSQL(`
        UPDATE equipos 
        SET nombre=?, id_club_fk=?, escudo=?, activo=?
        WHERE id=?
    `, [o.nombre, o.id_club_fk, o.escudo, o.activo, o.id])
}

exports.delete = async id => {
    return queryMYSQL(`
        UPDATE equipos SET activo = 0
        WHERE id = ?
    `, [id])
}