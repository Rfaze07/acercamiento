const { queryMYSQL } = require("../../database")


exports.execQuery = (query, params) => {
    return queryMYSQL(query, params)
}

exports.getAll = () => {
	return queryMYSQL(`
        SELECT j.*, e.nombre as equipo
        FROM jugadores j
        LEFT JOIN equipos e ON j.id_equipo_fk = e.id
        ORDER BY j.nombre
    `, [])
}

exports.getAllbyActivo = a => {
	return queryMYSQL(`
        SELECT j.*, e.nombre as equipo
        FROM jugadores j
        LEFT JOIN equipos e ON j.id_equipo_fk = e.id
        WHERE j.activo = ?
        ORDER BY j.nombre
    `, [a])
}

exports.getLista = filtros => {
    let query = `
        SELECT j.*, e.nombre AS equipo
        FROM jugadores j
        LEFT JOIN equipos e ON j.id_equipo_fk = e.id
        WHERE 1 = 1
    `
    const params = []
    if (filtros.equipo === 'sin_equipo') {
        query += ' AND j.id_equipo_fk IS NULL'
    } else if (filtros.equipo && filtros.equipo !== 't') {
        query += ' AND j.id_equipo_fk = ?'
        params.push(filtros.equipo)
    }
    if (filtros.activo != null && filtros.activo !== '' && filtros.activo !== 't') {
        query += ' AND j.activo = ?'
        params.push(filtros.activo)
    }
    query += ' ORDER BY j.nombre'
    return queryMYSQL(query, params)
}

exports.getById = id => {
	return queryMYSQL(`
        SELECT j.*, e.nombre as equipo
        FROM jugadores j
        LEFT JOIN equipos e ON j.id_equipo_fk = e.id
        WHERE j.id = ?
    `, [id])
}

exports.getByDesc = async desc => {
    return queryMYSQL(`
        select j.*, e.nombre as equipo
        FROM jugadores j
        LEFT JOIN equipos e ON j.id_equipo_fk = e.id
        where j.nombre = ?
    `, [desc])
}

exports.insert = o => {
    return queryMYSQL(`
        INSERT INTO jugadores (nombre, id_equipo_fk, dorsal) 
        VALUES (?, ?, ?)
    `, [o.nombre, o.id_equipo_fk, o.dorsal])
}

exports.update = o => {
    return queryMYSQL(`
        UPDATE jugadores 
        SET nombre=?, id_equipo_fk=?, dorsal=?, activo=? 
        WHERE id=?
    `, [o.nombre, o.id_equipo_fk, o.dorsal, o.activo, o.id])
}

exports.delete = async id => {
    return queryMYSQL(`
        UPDATE jugadores SET activo = 0
        WHERE id = ?
    `, [id])
}